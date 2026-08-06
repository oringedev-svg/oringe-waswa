// Per-user Google Calendar access.
//
// Deliberately separate from google-drive.ts: Drive uses a firm-wide service
// account (the firm owns the documents), whereas a calendar belongs to a
// person. Writing to someone's calendar, and generating a Meet link they
// actually host, requires their own OAuth grant. A service account cannot
// stand in for that.

import { google, calendar_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

export interface CalendarConnection {
  id: string
  provider: 'google' | 'microsoft'
  calendar_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
}

/** Tokens that changed during a call and must be written back to the row. */
export interface RefreshedTokens {
  access_token: string
  refresh_token?: string
  token_expires_at: string | null
}

export interface ExternalEventInput {
  title: string
  description?: string | null
  location?: string | null
  startAt: string
  endAt: string
  attendeeEmails?: string[]
  /** Ask Google to mint a Meet link and attach it to this event. */
  withMeet?: boolean
}

function config() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/connect/google/callback`,
  }
}

export function isGoogleCalendarConfigured(): boolean {
  const { clientId, clientSecret } = config()
  return Boolean(clientId && clientSecret)
}

function oauthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = config()
  if (!clientId || !clientSecret) throw new Error('Google Calendar OAuth is not configured')
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

// ---------------------------------------------------------------------------
// Consent flow
// ---------------------------------------------------------------------------

export function getGoogleAuthUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    // Without this Google omits the refresh token on every consent after the
    // first, which silently produces a connection that dies in an hour.
    prompt: 'consent',
    include_granted_scopes: true,
  })
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string | null
  email: string | null
}> {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  let email: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const me = await oauth2.userinfo.get()
    email = me.data.email || null
  } catch {
    // A missing address only costs us a label in the UI.
  }

  return {
    access_token: tokens.access_token || '',
    refresh_token: tokens.refresh_token || null,
    token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scopes: tokens.scope || null,
    email,
  }
}

// ---------------------------------------------------------------------------
// Authorised client
// ---------------------------------------------------------------------------

/**
 * Returns a client bound to this connection. If the access token was expired,
 * google-auth-library refreshes it during the first API call and reports the
 * new values through `refreshed`, which the caller must persist, otherwise
 * every future call pays for another refresh.
 */
function authedClient(conn: CalendarConnection): { client: OAuth2Client; refreshed: () => RefreshedTokens | null } {
  const client = oauthClient()
  client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token || undefined,
    expiry_date: conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : undefined,
  })

  let latest: RefreshedTokens | null = null
  client.on('tokens', (tokens) => {
    if (!tokens.access_token) return
    latest = {
      access_token: tokens.access_token,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }
  })

  return { client, refreshed: () => latest }
}

function calendarFor(conn: CalendarConnection) {
  const { client, refreshed } = authedClient(conn)
  return { api: google.calendar({ version: 'v3', auth: client }) as calendar_v3.Calendar, refreshed }
}

function toGoogleEvent(input: ExternalEventInput): calendar_v3.Schema$Event {
  return {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
    start: { dateTime: new Date(input.startAt).toISOString() },
    end: { dateTime: new Date(input.endAt).toISOString() },
    attendees: input.attendeeEmails?.length
      ? input.attendeeEmails.map((email) => ({ email }))
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Event operations
// ---------------------------------------------------------------------------

export async function createGoogleEvent(
  conn: CalendarConnection,
  input: ExternalEventInput,
): Promise<{ externalEventId: string; meetLink: string | null; refreshed: RefreshedTokens | null }> {
  const { api, refreshed } = calendarFor(conn)

  const requestBody = toGoogleEvent(input)
  if (input.withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        // Google requires a caller-supplied idempotency key here.
        requestId: `owa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const res = await api.events.insert({
    calendarId: conn.calendar_id || 'primary',
    requestBody,
    // Meet links are only minted when the caller opts into conference data.
    conferenceDataVersion: input.withMeet ? 1 : 0,
    sendUpdates: 'none',
  })

  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null

  return { externalEventId: res.data.id!, meetLink, refreshed: refreshed() }
}

export async function updateGoogleEvent(
  conn: CalendarConnection,
  externalEventId: string,
  input: ExternalEventInput,
): Promise<{ refreshed: RefreshedTokens | null }> {
  const { api, refreshed } = calendarFor(conn)
  await api.events.patch({
    calendarId: conn.calendar_id || 'primary',
    eventId: externalEventId,
    requestBody: toGoogleEvent(input),
    sendUpdates: 'none',
  })
  return { refreshed: refreshed() }
}

export async function deleteGoogleEvent(
  conn: CalendarConnection,
  externalEventId: string,
): Promise<{ refreshed: RefreshedTokens | null }> {
  const { api, refreshed } = calendarFor(conn)
  try {
    await api.events.delete({
      calendarId: conn.calendar_id || 'primary',
      eventId: externalEventId,
      sendUpdates: 'none',
    })
  } catch (e) {
    // Already gone on the remote side is the outcome we wanted anyway.
    const status = (e as { code?: number })?.code
    if (status !== 404 && status !== 410) throw e
  }
  return { refreshed: refreshed() }
}
