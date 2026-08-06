import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { isGoogleCalendarConfigured } from '@/lib/googleCalendar'
import { isMicrosoftCalendarConfigured } from '@/lib/microsoftGraph'

// A connection is personal: everyone manages only their own, so there is no
// admin guard here beyond being signed in, and no route by which one person
// can read or revoke another's grant.

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('user_calendar_connections')
    // Deliberately never selects access_token or refresh_token.
    .select('id, provider, external_email, sync_enabled, last_sync_at, last_sync_error, created_at')
    .eq('profile_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    connections: data || [],
    available: {
      google: isGoogleCalendarConfigured(),
      microsoft: isMicrosoftCalendarConfigured(),
    },
  })
}

export async function PATCH(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { provider, sync_enabled } = await req.json()
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('user_calendar_connections')
    .update({ sync_enabled: Boolean(sync_enabled), updated_at: new Date().toISOString() })
    .eq('profile_id', profile.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const provider = req.nextUrl.searchParams.get('provider')
  if (provider !== 'google' && provider !== 'microsoft') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const db = createAdminClient()
  // calendar_event_sync rows cascade from the connection, so past events stop
  // being tracked rather than being deleted off the person's calendar. Their
  // existing copies stay where they are, which is what disconnecting means.
  const { error } = await db
    .from('user_calendar_connections')
    .delete()
    .eq('profile_id', profile.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
