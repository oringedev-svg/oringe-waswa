import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { exchangeGoogleCode } from '@/lib/googleCalendar'
import { verifyOAuthState } from '@/lib/oauthState'

function back(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/calendar', process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const denied = req.nextUrl.searchParams.get('error')

  if (denied) return back(req, { calendar_error: 'Google Calendar connection was cancelled.' })
  if (!code) return back(req, { calendar_error: 'Google did not return an authorisation code.' })

  // The state must both verify and belong to the person currently signed in,
  // otherwise a callback captured from one session could attach a calendar to
  // somebody else's account.
  const stateProfileId = verifyOAuthState(state)
  if (!stateProfileId || stateProfileId !== profile.id) {
    return back(req, { calendar_error: 'That connection request expired or was invalid. Please try again.' })
  }

  try {
    const tokens = await exchangeGoogleCode(code)
    const db = createAdminClient()

    await db.from('user_calendar_connections').upsert(
      {
        profile_id: profile.id,
        provider: 'google',
        external_email: tokens.email,
        calendar_id: 'primary',
        access_token: tokens.access_token,
        // Omitted rather than nulled when absent: a re-consent that returns no
        // refresh token must not wipe the working one already stored.
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        token_expires_at: tokens.token_expires_at,
        scopes: tokens.scopes,
        sync_enabled: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,provider' },
    )

    return back(req, { calendar_connected: 'google' })
  } catch (e) {
    console.error('Google Calendar connect failed:', e)
    return back(req, { calendar_error: 'Could not connect Google Calendar. Please try again.' })
  }
}
