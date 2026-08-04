import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { getCurrentFirmId } from '@/lib/domainEvents'
import { logAudit } from '@/lib/audit'
import { COMPLIANCE_SENSITIVE } from '@/lib/checkPermission'

const SCOPE_TYPES = ['firm', 'office', 'department', 'team', 'matter']

// `params.id` is profiles.id, consistent with every other /api/users/[id]
// sub-route (see /api/users/[id]/permissions).
async function resolveUserId(profileId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('profiles').select('user_id').eq('id', profileId).single()
  return data?.user_id as string | undefined
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const userId = await resolveUserId(id)
  if (!userId) return NextResponse.json({ grants: [] })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('permission_grants')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ grants: data || [] })
}

// POST: A scoped, individual grant (I4 -- additive only, on top of
// whatever the person's role(s) already give them). This is the scoped
// counterpart to the existing firm-wide user_permissions checkbox: use
// this one when someone should get a permission ONLY on one matter, team,
// or department, not everywhere.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const body = await req.json()
  const permissionKey = body.permission_key as string
  const scopeType = (body.scope_type as string) || 'firm'
  const scopeId = body.scope_id || null
  const reason = (body.reason || '').trim()
  const expiresAt = body.expires_at || null

  if (!permissionKey) return NextResponse.json({ error: 'permission_key is required' }, { status: 400 })
  if (!SCOPE_TYPES.includes(scopeType)) {
    return NextResponse.json({ error: `scope_type must be one of: ${SCOPE_TYPES.join(', ')}` }, { status: 400 })
  }
  if (scopeType !== 'firm' && !scopeId) {
    return NextResponse.json({ error: 'scope_id is required for any scope narrower than firm-wide' }, { status: 400 })
  }
  if (!reason) return NextResponse.json({ error: 'A reason is required for a scoped grant (audit trail)' }, { status: 400 })
  // I6: compliance-sensitive commands must resolve to a role, never an
  // individual override -- checkPermission() already refuses to honour a
  // direct grant for one of these, so creating it here would be a row
  // that looks like it does something but silently never will.
  if (COMPLIANCE_SENSITIVE.has(permissionKey)) {
    return NextResponse.json(
      { error: 'This permission is compliance-sensitive and can only be granted via a role, not an individual override' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: profile } = await supabase.from('profiles').select('id, user_id, full_name').eq('id', id).single()
  if (!profile) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  if (!profile.user_id) return NextResponse.json({ error: `${profile.full_name} has not activated their account yet` }, { status: 400 })

  const { data: permission } = await supabase.from('permissions').select('key').eq('key', permissionKey).maybeSingle()
  if (!permission) return NextResponse.json({ error: 'Unknown permission key' }, { status: 400 })

  const firmId = await getCurrentFirmId()
  if (!firmId) return NextResponse.json({ error: 'No firm found' }, { status: 404 })

  const { data, error } = await supabase
    .from('permission_grants')
    .insert({
      user_id: profile.user_id,
      firm_id: firmId,
      permission_key: permissionKey,
      scope_type: scopeType,
      scope_id: scopeId,
      granted_by: guard.profile.userId,
      reason,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This exact grant already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'permission_grants',
    record_id: data.id,
    action: 'INSERT',
    new_data: { profile_id: id, permission_key: permissionKey, scope_type: scopeType, scope_id: scopeId, reason },
    performed_by: guard.profile.id,
  })

  return NextResponse.json(data, { status: 201 })
}
