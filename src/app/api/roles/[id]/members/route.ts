import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { getCurrentFirmId } from '@/lib/domainEvents'
import { logAudit } from '@/lib/audit'

// GET: Everyone currently assigned this role, resolved to their profile
// (user_roles.user_id is auth.users.id, matching profiles.user_id).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data: memberships, error } = await supabase.from('user_roles').select('id, user_id, created_at').eq('role_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (memberships || []).map((m) => m.user_id)
  if (userIds.length === 0) return NextResponse.json({ members: [] })

  const { data: profiles } = await supabase.from('profiles').select('id, user_id, full_name, email').in('user_id', userIds)
  const profileByUserId = new Map((profiles || []).map((p) => [p.user_id, p]))

  const members = (memberships || [])
    .map((m) => {
      const profile = profileByUserId.get(m.user_id)
      return profile ? { membership_id: m.id, profile_id: profile.id, full_name: profile.full_name, email: profile.email, assigned_at: m.created_at } : null
    })
    .filter((m): m is NonNullable<typeof m> => !!m)

  return NextResponse.json({ members })
}

// POST: Assign a role to a user, additive on top of their base
// profiles.role (this is what lets someone be "staff" AND hold a scoped
// "Conveyancing Lead" role at the same time).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const body = await req.json()
  const profileId = body.profile_id as string
  if (!profileId) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: role } = await supabase.from('roles').select('id').eq('id', id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('id, user_id, full_name').eq('id', profileId).single()
  if (!profile) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  if (!profile.user_id) {
    return NextResponse.json({ error: `${profile.full_name} has not activated their account yet` }, { status: 400 })
  }

  const firmId = await getCurrentFirmId()
  if (!firmId) return NextResponse.json({ error: 'No firm found' }, { status: 404 })

  const { data, error } = await supabase
    .from('user_roles')
    .insert({ user_id: profile.user_id, role_id: id, firm_id: firmId, assigned_by: guard.profile.userId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `${profile.full_name} already holds this role` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'user_roles',
    record_id: data.id,
    action: 'INSERT',
    new_data: { role_id: id, profile_id: profileId },
    performed_by: guard.profile.id,
  })

  return NextResponse.json({ membership_id: data.id, profile_id: profile.id, full_name: profile.full_name }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const membershipId = searchParams.get('membership_id')
  if (!membershipId) return NextResponse.json({ error: 'membership_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('user_roles').select('*').eq('id', membershipId).eq('role_id', id).single()
  if (!existing) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })

  const { error } = await supabase.from('user_roles').delete().eq('id', membershipId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'user_roles', record_id: membershipId, action: 'DELETE', old_data: existing, performed_by: guard.profile.id })
  return NextResponse.json({ success: true })
}
