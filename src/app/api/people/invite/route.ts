import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Sends a client a passwordless sign-in link, no account creation flow, no
// password to set or forget. Clicking the emailed link signs them straight
// into /portal; the browser's Supabase client detects the session from the
// URL automatically. Re-sendable at any time, a returning client can always
// request a fresh link, there is nothing to "already have" that blocks it.
// (Staff, pupils, and administrative assistants still use real accounts
// with passwords, created via /api/team/[id]/create-account, this route is
// client-only by convention, clients don't hold credentials at all.)
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { profile_id } = await req.json()
  if (!profile_id) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', profile_id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const origin = new URL(req.url).origin
  const { error } = await supabase.auth.signInWithOtp({
    email: profile.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/portal`,
      data: { full_name: profile.full_name },
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'profiles', record_id: profile.id, action: 'UPDATE', new_data: { portal_link_sent: true } })
  return NextResponse.json({ success: true })
}
