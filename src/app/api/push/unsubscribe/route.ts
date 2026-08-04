import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })

  const supabase = createAdminClient()
  // Scoped to the caller's own profile_id so one person's endpoint string
  // can never be used to delete someone else's subscription.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('profile_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
