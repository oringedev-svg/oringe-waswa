import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const SCOPE_TYPES = ['firm', 'office', 'department', 'team', 'matter']

// POST: Grant a role a permission at a scope (I1). scope_type='firm' (the
// default) is what every existing role effectively means today; picking a
// narrower scope_type with a scope_id is what makes a role like
// "Conveyancing Lead" only reach that one practice area's matters instead
// of every matter in the firm.
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

  if (!permissionKey) return NextResponse.json({ error: 'permission_key is required' }, { status: 400 })
  if (!SCOPE_TYPES.includes(scopeType)) {
    return NextResponse.json({ error: `scope_type must be one of: ${SCOPE_TYPES.join(', ')}` }, { status: 400 })
  }
  if (scopeType !== 'firm' && !scopeId) {
    return NextResponse.json({ error: 'scope_id is required for any scope narrower than firm-wide' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: role } = await supabase.from('roles').select('id').eq('id', id).single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  const { data: permission } = await supabase.from('permissions').select('key').eq('key', permissionKey).maybeSingle()
  if (!permission) return NextResponse.json({ error: 'Unknown permission key' }, { status: 400 })

  const { data, error } = await supabase
    .from('role_permissions')
    .insert({ role_id: id, permission_key: permissionKey, scope_type: scopeType, scope_id: scopeId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This role already has that permission at that scope' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'role_permissions',
    record_id: data.id,
    action: 'INSERT',
    new_data: { role_id: id, permission_key: permissionKey, scope_type: scopeType, scope_id: scopeId },
    performed_by: guard.profile.id,
  })

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const grantId = searchParams.get('grant_id')
  if (!grantId) return NextResponse.json({ error: 'grant_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from('role_permissions').select('*').eq('id', grantId).eq('role_id', id).single()
  if (!existing) return NextResponse.json({ error: 'Grant not found' }, { status: 404 })

  const { error } = await supabase.from('role_permissions').delete().eq('id', grantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'role_permissions', record_id: grantId, action: 'DELETE', old_data: existing, performed_by: guard.profile.id })
  return NextResponse.json({ success: true })
}
