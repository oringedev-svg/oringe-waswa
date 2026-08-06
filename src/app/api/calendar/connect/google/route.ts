import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from '@/lib/googleCalendar'
import { signOAuthState } from '@/lib/oauthState'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: 'Google Calendar integration is not configured on this server.' },
      { status: 501 },
    )
  }

  return NextResponse.redirect(getGoogleAuthUrl(signOAuthState(profile.id)))
}
