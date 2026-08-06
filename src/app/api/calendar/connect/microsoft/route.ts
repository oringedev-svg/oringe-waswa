import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { getMicrosoftAuthUrl, isMicrosoftCalendarConfigured } from '@/lib/microsoftGraph'
import { signOAuthState } from '@/lib/oauthState'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (!isMicrosoftCalendarConfigured()) {
    return NextResponse.json(
      { error: 'Outlook Calendar integration is not configured on this server.' },
      { status: 501 },
    )
  }

  return NextResponse.redirect(getMicrosoftAuthUrl(signOAuthState(profile.id)))
}
