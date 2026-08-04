import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

// Any signed-in role can subscribe -- a client waiting on their matter is
// as legitimate a recipient as a pupil waiting on their next assignment.
// What gets pushed to them is a separate, permissioned concern (see
// /api/push/send); subscribing itself just registers a device.
export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json()
  const { endpoint, keys } = body?.subscription || body || {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'A valid push subscription (endpoint, keys.p256dh, keys.auth) is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        profile_id: profile.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: req.headers.get('user-agent') || null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
