// Mirrors application events onto whatever personal calendars staff have
// connected.
//
// Two rules govern everything here:
//
//   1. The application is authoritative. External calendars are copies. A
//      failure to write a copy must never fail the scheduling action that
//      produced it, so every entry point swallows its errors and records
//      them on the connection instead.
//
//   2. Nobody gets a duplicate. When a Meet or Teams link was minted, the
//      organiser's calendar already holds the event, so that connection is
//      skipped rather than written twice.

import { createAdminClient } from '@/lib/supabase'
import { resolveAttendees } from '@/lib/attendeeResolver'
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  isGoogleCalendarConfigured,
  type CalendarConnection,
  type RefreshedTokens,
  type ExternalEventInput,
} from './googleCalendar'
import {
  createMicrosoftEvent,
  updateMicrosoftEvent,
  deleteMicrosoftEvent,
  isMicrosoftCalendarConfigured,
} from './microsoftGraph'

type Db = ReturnType<typeof createAdminClient>

const CONNECTION_FIELDS =
  'id, profile_id, provider, calendar_id, access_token, refresh_token, token_expires_at, sync_enabled'

interface ConnectionRow extends CalendarConnection {
  profile_id: string
  sync_enabled: boolean
}

export function isAnyCalendarSyncConfigured(): boolean {
  return isGoogleCalendarConfigured() || isMicrosoftCalendarConfigured()
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export async function getConnection(
  db: Db,
  profileId: string,
  provider: 'google' | 'microsoft',
): Promise<CalendarConnection | null> {
  const { data } = await db
    .from('user_calendar_connections')
    .select(CONNECTION_FIELDS)
    .eq('profile_id', profileId)
    .eq('provider', provider)
    .eq('sync_enabled', true)
    .maybeSingle()
  return (data as ConnectionRow) || null
}

/**
 * Access tokens are short-lived, so a refresh during a sync is routine rather
 * than exceptional. Not writing the new one back would mean refreshing again
 * on every subsequent call.
 */
export async function persistRefreshedTokens(
  db: Db,
  connectionId: string,
  refreshed: RefreshedTokens | null | undefined,
): Promise<void> {
  if (!refreshed) return
  await db
    .from('user_calendar_connections')
    .update({
      access_token: refreshed.access_token,
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      token_expires_at: refreshed.token_expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
}

async function recordSyncError(db: Db, connectionId: string, error: unknown): Promise<void> {
  await db
    .from('user_calendar_connections')
    .update({
      last_sync_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
}

async function markSynced(db: Db, connectionId: string): Promise<void> {
  await db
    .from('user_calendar_connections')
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
    .eq('id', connectionId)
}

// ---------------------------------------------------------------------------
// Who this event should appear for
// ---------------------------------------------------------------------------

/**
 * Everyone on the event who has a profile: attendees invited directly, staff
 * attendees reached through their team member record, and the organiser.
 * External guests with only an email address have no account here and so no
 * connection to sync to; they still get the .ics invite.
 */
async function profileIdsForEvent(db: Db, eventId: string, createdBy: string | null): Promise<string[]> {
  const { data: attendees } = await db
    .from('calendar_event_attendees')
    .select('profile_id, team_member_id')
    .eq('event_id', eventId)

  const ids = new Set<string>()
  if (createdBy) ids.add(createdBy)

  const teamMemberIds: string[] = []
  for (const a of attendees || []) {
    if (a.profile_id) ids.add(a.profile_id)
    else if (a.team_member_id) teamMemberIds.push(a.team_member_id)
  }

  if (teamMemberIds.length) {
    const { data: members } = await db
      .from('team_members')
      .select('profile_id')
      .in('id', teamMemberIds)
    for (const m of members || []) {
      if (m.profile_id) ids.add(m.profile_id)
    }
  }

  return [...ids]
}

async function connectionsForEvent(db: Db, eventId: string, createdBy: string | null): Promise<ConnectionRow[]> {
  const profileIds = await profileIdsForEvent(db, eventId, createdBy)
  if (!profileIds.length) return []

  const { data } = await db
    .from('user_calendar_connections')
    .select(CONNECTION_FIELDS)
    .in('profile_id', profileIds)
    .eq('sync_enabled', true)

  return (data as ConnectionRow[]) || []
}

// ---------------------------------------------------------------------------
// Event shape
// ---------------------------------------------------------------------------

interface EventRow {
  id: string
  title: string
  description: string | null
  location: string | null
  meeting_link: string | null
  start_at: string
  end_at: string
  created_by: string | null
}

async function toExternalInput(db: Db, event: EventRow): Promise<ExternalEventInput> {
  const { data: attendees } = await db
    .from('calendar_event_attendees')
    .select('team_member_id, profile_id, external_name, external_email')
    .eq('event_id', event.id)

  const resolved = await resolveAttendees(
    (attendees || []) as { team_member_id?: string; profile_id?: string; external_name?: string; external_email?: string }[],
  )

  // The join link belongs in the body too: an attendee looking at their own
  // calendar should not have to come back here to find it.
  const description = [event.description, event.meeting_link ? `Join: ${event.meeting_link}` : null]
    .filter(Boolean)
    .join('\n\n')

  return {
    title: event.title,
    description: description || null,
    location: event.location,
    startAt: event.start_at,
    endAt: event.end_at,
    attendeeEmails: resolved.map((r) => r.email).filter(Boolean),
  }
}

async function loadEvent(db: Db, eventId: string): Promise<EventRow | null> {
  const { data } = await db
    .from('calendar_events')
    .select('id, title, description, location, meeting_link, start_at, end_at, created_by')
    .eq('id', eventId)
    .maybeSingle()
  return (data as EventRow) || null
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Mirrors a newly created event onto every connected calendar. Pass the
 * connection id already written by a Meet/Teams provider so the organiser is
 * not invited to their own meeting twice.
 */
export async function syncEventCreated(eventId: string, skipConnectionId?: string | null): Promise<void> {
  if (!isAnyCalendarSyncConfigured()) return

  const db = createAdminClient()
  try {
    const event = await loadEvent(db, eventId)
    if (!event) return

    const connections = await connectionsForEvent(db, eventId, event.created_by)
    if (!connections.length) return

    const input = await toExternalInput(db, event)

    await Promise.all(
      connections
        .filter((c) => c.id !== skipConnectionId)
        .map(async (conn) => {
          try {
            const result =
              conn.provider === 'google'
                ? await createGoogleEvent(conn, input)
                : await createMicrosoftEvent(conn, input)

            await db.from('calendar_event_sync').upsert(
              {
                event_id: eventId,
                connection_id: conn.id,
                external_event_id: result.externalEventId,
                last_synced_at: new Date().toISOString(),
                sync_error: null,
              },
              { onConflict: 'event_id,connection_id' },
            )

            await persistRefreshedTokens(db, conn.id, result.refreshed)
            await markSynced(db, conn.id)
          } catch (e) {
            await recordSyncError(db, conn.id, e)
          }
        }),
    )
  } catch (e) {
    console.error('Calendar sync (create) failed:', e)
  }
}

/** Records an event the provider already created, so updates can find it. */
export async function recordOrganizerSync(
  eventId: string,
  connectionId: string,
  externalEventId: string,
): Promise<void> {
  const db = createAdminClient()
  try {
    await db.from('calendar_event_sync').upsert(
      {
        event_id: eventId,
        connection_id: connectionId,
        external_event_id: externalEventId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,connection_id' },
    )
  } catch (e) {
    console.error('Calendar sync (record organiser) failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function syncEventUpdated(eventId: string): Promise<void> {
  if (!isAnyCalendarSyncConfigured()) return

  const db = createAdminClient()
  try {
    const event = await loadEvent(db, eventId)
    if (!event) return

    const { data: syncRows } = await db
      .from('calendar_event_sync')
      .select(`external_event_id, connection:user_calendar_connections(${CONNECTION_FIELDS})`)
      .eq('event_id', eventId)

    if (!syncRows?.length) return

    const input = await toExternalInput(db, event)

    await Promise.all(
      syncRows.map(async (row) => {
        const conn = (Array.isArray(row.connection) ? row.connection[0] : row.connection) as ConnectionRow | null
        if (!conn || !conn.sync_enabled) return
        try {
          const result =
            conn.provider === 'google'
              ? await updateGoogleEvent(conn, row.external_event_id, input)
              : await updateMicrosoftEvent(conn, row.external_event_id, input)

          await persistRefreshedTokens(db, conn.id, result.refreshed)
          await markSynced(db, conn.id)
        } catch (e) {
          await recordSyncError(db, conn.id, e)
        }
      }),
    )
  } catch (e) {
    console.error('Calendar sync (update) failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function syncEventCancelled(eventId: string): Promise<void> {
  if (!isAnyCalendarSyncConfigured()) return

  const db = createAdminClient()
  try {
    const { data: syncRows } = await db
      .from('calendar_event_sync')
      .select(`id, external_event_id, connection:user_calendar_connections(${CONNECTION_FIELDS})`)
      .eq('event_id', eventId)

    if (!syncRows?.length) return

    await Promise.all(
      syncRows.map(async (row) => {
        const conn = (Array.isArray(row.connection) ? row.connection[0] : row.connection) as ConnectionRow | null
        if (!conn) return
        try {
          const result =
            conn.provider === 'google'
              ? await deleteGoogleEvent(conn, row.external_event_id)
              : await deleteMicrosoftEvent(conn, row.external_event_id)

          await persistRefreshedTokens(db, conn.id, result.refreshed)
          // The mapping is meaningless once the remote event is gone; leaving
          // it would make a later update try to patch a deleted event.
          await db.from('calendar_event_sync').delete().eq('id', row.id)
        } catch (e) {
          await recordSyncError(db, conn.id, e)
        }
      }),
    )
  } catch (e) {
    console.error('Calendar sync (cancel) failed:', e)
  }
}
