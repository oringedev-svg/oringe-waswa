import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Every role the app's own UI can select, kept as one list re-exported by
// every route in this family, so a role the create/list/update paths agree
// on can never silently diverge again (this is what broke PATCH earlier:
// its own local list had fallen behind the one the page actually offers).
export const ASSIGNABLE_ROLES = ['admin', 'staff', 'moderator', 'pupil', 'admin_assistant', 'client', 'public']

export async function GET() {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, role, is_active, created_at')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: grants } = await supabase.from('user_permissions').select('user_id, permission_key')
  const grantsByUser: Record<string, string[]> = {}
  for (const g of grants || []) {
    grantsByUser[g.user_id] = grantsByUser[g.user_id] || []
    grantsByUser[g.user_id].push(g.permission_key)
  }

  // Invited-but-not-yet-accepted people: a profiles row exists (created by
  // POST below, or by /api/team/[id]/create-account) but user_id is still
  // null because the invite email hasn't been opened. Surfaced separately
  // so "I invited someone" doesn't look like it silently did nothing.
  const { data: pending } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .is('user_id', null)
    .order('created_at', { ascending: false })

  const withGrants = (users || []).map((u) => ({ ...u, grants: grantsByUser[u.user_id] || [] }))
  return NextResponse.json({ users: withGrants, pending: pending || [] })
}

// POST: Create a brand-new user directly -- the gap this closes is that
// today, adding anyone who isn't already a team_member (staff/pupil) or a
// people/client record means creating them by hand in the Supabase Auth
// dashboard, with no guarantee a matching, correctly-roled `profiles` row
// ever gets created to go with it. This is the one front door for that,
// for every role at once.
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const email = (body.email || '').trim().toLowerCase()
  const fullName = (body.full_name || '').trim()
  const role = body.role
  const permissionKeys: string[] = Array.isArray(body.permission_keys) ? body.permission_keys : []

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!fullName) return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }, { status: 400 })
  }
  // Granting admin is granting every permission in the system, including
  // the ability to grant it again to someone else. A caller who reaches
  // this endpoint only via an individually-flat-granted manage_users
  // (not the admin role itself) must not be able to mint a peer with more
  // authority than they hold.
  if (role === 'admin' && guard.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only an administrator can create another administrator' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('profiles').select('id, user_id').eq('email', email).maybeSingle()
  if (existing?.user_id) {
    return NextResponse.json({ error: 'A user with this email already has an account' }, { status: 409 })
  }

  let profileId = existing?.id
  if (!profileId) {
    const { data: created, error } = await supabase
      .from('profiles')
      .insert({ full_name: fullName, email, role })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    profileId = created.id
  } else {
    // A profile row exists but was never activated (e.g. a prior invite
    // that was never opened) -- refresh it to the current name/role rather
    // than leaving stale values from whenever it was first created.
    await supabase.from('profiles').update({ full_name: fullName, role }).eq('id', profileId)
  }

  const origin = new URL(req.url).origin
  let userId: string | null = null

  // Clients sign in passwordlessly (see /api/people/invite); every other
  // role gets a real password account via the admin invite, same as
  // /api/team/[id]/create-account.
  if (role === 'client') {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${origin}/portal`, data: { full_name: fullName } },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // signInWithOtp's response never carries the user id (no session exists
    // yet for an unverified OTP), the on_auth_user_created trigger backfills
    // profiles.user_id asynchronously, initial permission grants below are
    // skipped for this path as a result -- clients essentially never carry
    // permission_keys in practice, this is not worth a polling round-trip.
  } else {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
      data: { full_name: fullName },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    userId = data.user?.id ?? null
  }

  if (userId && permissionKeys.length > 0) {
    await supabase.from('user_permissions').insert(
      permissionKeys.map((key) => ({ user_id: userId, permission_key: key, granted_by: guard.profile.userId }))
    )
  }

  await logAudit({
    table_name: 'profiles',
    record_id: profileId!,
    action: 'INSERT',
    new_data: { email, full_name: fullName, role, invited: true },
    performed_by: guard.profile.id,
  })

  return NextResponse.json({ success: true, profile_id: profileId, role }, { status: 201 })
}
