// Per-user Outlook Calendar and Teams meeting access via Microsoft Graph.
//
// Plain fetch rather than an SDK, same approach as openai.ts: the surface we
// need is four REST calls and a token exchange, which is not worth another
// dependency.
//
// Mirrors googleCalendar.ts function-for-function so calendarSync.ts can
// treat the two providers as interchangeable.

import type { CalendarConnection, RefreshedTokens, ExternalEventInput } from './googleCalendar'

const GRAPH = 'https://graph.microsoft.com/v1.0'

const SCOPES = [
  'offline_access',
  'openid',
  'email',
  'User.Read',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
]

function config() {
  return {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    // 'common' accepts both work/school and personal accounts. A single-tenant
    // app registration should set this to its own tenant id instead.
    tenant: process.env.MICROSOFT_OAUTH_TENANT || 'common',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/connect/microsoft/callback`,
  }
}

export function isMicrosoftCalendarConfigured(): boolean {
  const { clientId, clientSecret } = config()
  return Boolean(clientId && clientSecret)
}

// ---------------------------------------------------------------------------
// Consent flow
// ---------------------------------------------------------------------------

export function getMicrosoftAuthUrl(state: string): string {
  const { clientId, tenant, redirectUri } = config()
  if (!clientId) throw new Error('Microsoft Calendar OAuth is not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state,
  })
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`
}

async function tokenRequest(body: Record<string, string>): Promise<{
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scopes: string | null
}> {
  const { clientId, clientSecret, tenant, redirectUri } = config()
  if (!clientId || !clientSecret) throw new Error('Microsoft Calendar OAuth is not configured')

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      ...body,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Microsoft token request failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const json = await res.json()
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || null,
    token_expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
    scopes: json.scope || null,
  }
}

export async function exchangeMicrosoftCode(code: string) {
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code })

  let email: string | null = null
  try {
    const res = await fetch(`${GRAPH}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (res.ok) {
      const me = await res.json()
      email = me.mail || me.userPrincipalName || null
    }
  } catch {
    // Only affects the label shown next to the connection.
  }

  return { ...tokens, email }
}

// ---------------------------------------------------------------------------
// Authorised requests
// ---------------------------------------------------------------------------

/**
 * Graph has no client library doing this for us, so expiry is checked up
 * front. A minute of slack avoids losing a request to a token that expires
 * mid-flight.
 */
async function ensureFreshToken(
  conn: CalendarConnection,
): Promise<{ accessToken: string; refreshed: RefreshedTokens | null }> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0
  const stillValid = expiresAt > Date.now() + 60_000

  if (stillValid || !conn.refresh_token) {
    return { accessToken: conn.access_token, refreshed: null }
  }

  const tokens = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token,
  })

  return {
    accessToken: tokens.access_token,
    refreshed: {
      access_token: tokens.access_token,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      token_expires_at: tokens.token_expires_at,
    },
  }
}

async function graphFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const detail = await res.text().catch(() => '')
    // Personal Microsoft accounts can hold a calendar but cannot host Teams
    // meetings, which surfaces here as a 403. Say so plainly rather than
    // leaving a raw Graph payload in the log.
    if (res.status === 403 && detail.includes('OnlineMeeting')) {
      throw new Error(
        'This Microsoft account cannot create Teams meetings. Teams meeting creation requires a Microsoft 365 work or school account with a Teams licence.',
      )
    }
    throw new Error(`Microsoft Graph ${path} failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  return res
}

function toGraphEvent(input: ExternalEventInput, withTeams: boolean) {
  return {
    subject: input.title,
    body: { contentType: 'HTML', content: input.description || '' },
    start: { dateTime: new Date(input.startAt).toISOString(), timeZone: 'UTC' },
    end: { dateTime: new Date(input.endAt).toISOString(), timeZone: 'UTC' },
    location: input.location ? { displayName: input.location } : undefined,
    attendees: (input.attendeeEmails || []).map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    ...(withTeams ? { isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' } : {}),
  }
}

// ---------------------------------------------------------------------------
// Event operations
// ---------------------------------------------------------------------------

export async function createMicrosoftEvent(
  conn: CalendarConnection,
  input: ExternalEventInput,
  withTeams = false,
): Promise<{ externalEventId: string; joinUrl: string | null; refreshed: RefreshedTokens | null }> {
  const { accessToken, refreshed } = await ensureFreshToken(conn)

  const res = await graphFetch(accessToken, '/me/events', {
    method: 'POST',
    body: JSON.stringify(toGraphEvent(input, withTeams)),
  })
  const event = await res.json()

  return {
    externalEventId: event.id,
    joinUrl: event.onlineMeeting?.joinUrl || null,
    refreshed,
  }
}

export async function updateMicrosoftEvent(
  conn: CalendarConnection,
  externalEventId: string,
  input: ExternalEventInput,
): Promise<{ refreshed: RefreshedTokens | null }> {
  const { accessToken, refreshed } = await ensureFreshToken(conn)
  await graphFetch(accessToken, `/me/events/${externalEventId}`, {
    method: 'PATCH',
    body: JSON.stringify(toGraphEvent(input, false)),
  })
  return { refreshed }
}

export async function deleteMicrosoftEvent(
  conn: CalendarConnection,
  externalEventId: string,
): Promise<{ refreshed: RefreshedTokens | null }> {
  const { accessToken, refreshed } = await ensureFreshToken(conn)
  // graphFetch already treats 404/410 as success: gone is gone.
  await graphFetch(accessToken, `/me/events/${externalEventId}`, { method: 'DELETE' })
  return { refreshed }
}
