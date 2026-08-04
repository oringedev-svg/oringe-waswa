import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Turns a team profile (public-facing, display-only) into a real account:
// find-or-create the matching `profiles` row, set its role from the team
// member's seniority (pupil -> 'pupil', administrative assistant ->
// 'admin_assistant', everyone else -> 'staff'), link the two records, and
// send the same Supabase invite email used for client portal access. What
// they can actually DO once they sign in is decided separately, on
// /admin/users, this step only gets them through the door.
const SENIORITY_TO_ROLE: Record<string, string> = {
  pupil: 'pupil',
  admin_assistant: 'admin_assistant',
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  // position_id (migration 020) may not exist yet on some deployments,
  // fall back to the select that always worked rather than breaking
  // account creation on an older schema.
  let member
  ;({ data: member } = await supabase
    .from('team_members')
    .select('id, full_name, email, seniority, profile_id, position_id')
    .eq('id', params.id)
    .single())
  if (!member) {
    ;({ data: member } = await supabase
      .from('team_members')
      .select('id, full_name, email, seniority, profile_id')
      .eq('id', params.id)
      .single())
  }
  if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  if (!member.email) return NextResponse.json({ error: 'This team member has no email on file' }, { status: 400 })

  // A position's maps_to_role is the more precise, firm-configured source
  // of truth once set; the seniority-based map is the original fallback,
  // kept working for anyone not yet migrated onto the new taxonomy.
  let role = SENIORITY_TO_ROLE[member.seniority] || 'staff'
  if ('position_id' in member && member.position_id) {
    const { data: position } = await supabase.from('positions').select('maps_to_role').eq('id', member.position_id).single()
    if (position?.maps_to_role) role = position.maps_to_role
  }

  let profileId = member.profile_id
  let userId: string | null = null

  if (profileId) {
    const { data: existing } = await supabase.from('profiles').select('id, user_id').eq('id', profileId).single()
    userId = existing?.user_id || null
  } else {
    let { data: profile } = await supabase.from('profiles').select('id, user_id').eq('email', member.email).maybeSingle()
    if (!profile) {
      const { data: created, error } = await supabase
        .from('profiles')
        .insert({ full_name: member.full_name, email: member.email, role })
        .select('id, user_id')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      profile = created
    }
    profileId = profile!.id
    userId = profile!.user_id
    await supabase.from('team_members').update({ profile_id: profileId }).eq('id', params.id)
  }

  if (userId) return NextResponse.json({ error: 'This person already has an account' }, { status: 400 })

  const origin = new URL(req.url).origin
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(member.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    data: { full_name: member.full_name },
  })
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  // Set profiles.user_id directly instead of trusting the
  // on_auth_user_created DB trigger to backfill it. Confirmed on this
  // deployment that it doesn't always: a person can be invited, confirm
  // their email, and even sign in successfully at the Supabase auth layer
  // while profiles.user_id stays null, which getSessionProfile() then
  // reads as "not signed in" no matter how many times they authenticate.
  // inviteUserByEmail returns the new user's id synchronously, no reason
  // to depend on the trigger for this path.
  if (inviteData.user?.id) {
    await supabase.from('profiles').update({ user_id: inviteData.user.id }).eq('id', profileId)
  }

  await logAudit({ table_name: 'profiles', record_id: profileId!, action: 'UPDATE', new_data: { invited: true, role } })
  return NextResponse.json({ success: true, role })
}
