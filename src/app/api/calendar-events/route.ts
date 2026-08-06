import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { buildIcsInvite, meetingInviteEmail } from '@/lib/ics'
import { resolveAttendees } from '@/lib/attendeeResolver'
import { getMeetingProvider, buildLocationSummary, type MeetingResult } from '@/lib/meetingProviders'
import { getConnection, persistRefreshedTokens, recordOrganizerSync, syncEventCreated } from '@/lib/calendarSync'

interface AttendeeInput {
  team_member_id?: string
  profile_id?: string
  external_name?: string
  external_email?: string
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const matterId = searchParams.get('matter_id')
  const submissionId = searchParams.get('submission_id')

  let query = supabase
    .from('calendar_events')
    .select('*, creator:profiles(full_name), matter:legal_matters(matter_number, title), submission:submissions(tracking_code, submitter_name), attendees:calendar_event_attendees(*, team_member:team_members(full_name, avatar_url), profile:profiles(full_name, email))')
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })

  if (from) query = query.gte('start_at', from)
  if (to) query = query.lte('start_at', to)
  if (matterId) query = query.eq('matter_id', matterId)
  if (submissionId) query = query.eq('submission_id', submissionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const {
    title, description, type, start_at, end_at, location, meeting_link,
    matter_id, submission_id, job_application_id, attendees,
    meeting_provider, venue_name, building, room, address, location_notes,
  } = body as {
    title: string; description?: string; type?: string; start_at: string; end_at: string
    location?: string; meeting_link?: string; matter_id?: string; submission_id?: string; job_application_id?: string
    attendees?: AttendeeInput[]
    meeting_provider?: string
    venue_name?: string; building?: string; room?: string; address?: string; location_notes?: string
  }

  if (!title || !start_at || !end_at) {
    return NextResponse.json({ error: 'title, start_at, and end_at are required' }, { status: 400 })
  }
  if (new Date(end_at) <= new Date(start_at)) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  // A caller from before the meeting-type picker existed sends a pasted link
  // and no provider. That is the manual provider, not a physical meeting.
  const providerKey = meeting_provider || (meeting_link ? 'other' : 'physical')
  const provider = getMeetingProvider(providerKey)

  // The structured venue fields are what the form edits, but `location` is
  // what the .ics builder, the invite email and every existing reader
  // consume, so it is derived here rather than kept in step by hand.
  const resolvedLocation = buildLocationSummary({ venue_name, building, room, address }) || location || null

  // Resolved before the event exists because the conferencing provider needs
  // the guest list to put the meeting on the right people's calendars.
  // Batched in exactly two queries via resolveAttendees(); was previously a
  // sequential per-attendee loop (a meeting with a dozen invitees fired
  // twenty-plus round trips).
  const resolved = await resolveAttendees<AttendeeInput>(attendees || [])

  // A conferencing link is hosted by a person, not by the firm, so it is
  // minted with the organiser's own grant. No grant, or a provider that
  // errors, costs the link but never the meeting: it is still scheduled and
  // everyone is still notified.
  let meeting: MeetingResult = { meetingLink: meeting_link || null, meetingExternalId: null }
  try {
    const organizerConnection = provider.requiresConnection
      ? await getConnection(supabase, guard.profile.id, provider.requiresConnection)
      : null

    meeting = await provider.createMeeting({
      title, description, location: resolvedLocation,
      startAt: start_at, endAt: end_at,
      attendeeEmails: resolved.map((r) => r.email).filter(Boolean),
      organizerConnection,
      manualLink: meeting_link,
    })

    if (organizerConnection) await persistRefreshedTokens(supabase, organizerConnection.id, meeting.refreshed)
  } catch (e) {
    console.error('Meeting provider failed:', e)
    meeting = {
      meetingLink: null,
      meetingExternalId: null,
      warning: e instanceof Error ? e.message : 'Could not create the online meeting.',
    }
  }

  const eventPayload = {
    title, description: description || null, type: type || 'meeting', start_at, end_at,
    location: resolvedLocation, meeting_link: meeting.meetingLink,
    matter_id: matter_id || null, submission_id: submission_id || null,
    // This is a recruitment-only column introduced in migration 037. Do
    // not name it for ordinary meetings: a database still awaiting that
    // migration must be able to schedule normal staff events.
    ...(job_application_id ? { job_application_id } : {}),
    created_by: guard.profile.id,
  }
  // Same reasoning as job_application_id, for migration 059: a database that
  // has not taken the meeting-provider columns yet must still be able to
  // schedule an ordinary meeting, so the richer payload is tried first and
  // the plain one is the fallback.
  const richPayload = {
    ...eventPayload,
    meeting_provider: providerKey,
    meeting_external_id: meeting.meetingExternalId,
    venue_name: venue_name || null, building: building || null, room: room || null,
    address: address || null, location_notes: location_notes || null,
  }

  let event: { id: string } | null = null
  let error: { message?: string } | null = null
  for (const payload of [richPayload, eventPayload]) {
    const result = await supabase.from('calendar_events').insert(payload).select().single()
    event = result.data
    error = result.error
    if (!error) break
  }
  if (error || !event) return NextResponse.json({ error: error?.message || 'Could not create the event' }, { status: 500 })
  const created = event

  let insertedAttendees: { id: string }[] = []
  if (resolved.length > 0) {
    const { data: inserted } = await supabase
      .from('calendar_event_attendees')
      .insert(
        resolved.map((r) => ({
          event_id: created.id,
          team_member_id: r.row.team_member_id || null,
          profile_id: r.row.profile_id || null,
          external_name: r.row.external_name || null,
          external_email: r.row.external_email || null,
        }))
      )
      .select('id')
    insertedAttendees = inserted || []
  }

  // Notify everyone with a calendar invite they can add anywhere. Best
  // effort, a mail failure never blocks the meeting from being created.
  try {
    const organizerName = guard.profile.fullName
    const ics = buildIcsInvite({
      uid: `${created.id}@oringewaswa`,
      title, description, location: resolvedLocation || undefined,
      startAt: start_at, endAt: end_at,
      organizer: { name: organizerName, email: process.env.EMAIL_USER || 'no-reply@oringewaswa.co.ke' },
      attendees: resolved.map((r) => ({ name: r.name, email: r.email })),
    })
    const html = meetingInviteEmail({ title, description, location: resolvedLocation || undefined, meetingLink: meeting.meetingLink || undefined, startAt: start_at, endAt: end_at, organizerName })
    await Promise.all(
      resolved.map((r, i) => {
        const attendeeId = insertedAttendees[i]?.id
        return sendEmail({
          to: r.email,
          subject: `Invitation: ${title}`,
          html,
          attachments: [{ filename: 'invite.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }],
        })
          .then(() => {
            if (attendeeId) return supabase.from('calendar_event_attendees').update({ notified_at: new Date().toISOString() }).eq('id', attendeeId)
          })
          .catch(() => {})
      })
    )
  } catch {}

  // Creating a Meet or Teams link already put the event on the organiser's
  // own calendar, so that copy is recorded (not repeated) and the fan-out to
  // everyone else skips it.
  if (meeting.organizerSync) {
    await recordOrganizerSync(created.id, meeting.organizerSync.connectionId, meeting.organizerSync.externalEventId)
  }
  await syncEventCreated(created.id, meeting.organizerSync?.connectionId)

  await logAudit({ table_name: 'calendar_events', record_id: created.id, action: 'INSERT', new_data: { title, start_at, attendees: resolved.length } })
  // `warning` carries "the meeting is booked but there is no link, and here
  // is why", which the caller should surface rather than treat as success.
  return NextResponse.json({ ...created, warning: meeting.warning || null }, { status: 201 })
}
