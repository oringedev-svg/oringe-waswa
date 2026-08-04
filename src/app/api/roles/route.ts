import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { getCurrentFirmId } from '@/lib/domainEvents'
import { logAudit } from '@/lib/audit'

// GET: List every role (the five system roles seeded by migration 028,
// plus any custom ones created here), each with its scoped permission
// grants and how many people currently hold it. This is the first UI
// surface for tables that have existed since migration 028 but that
// nothing has ever written to -- role_permissions and user_roles are
// empty until this page starts using them.
export async function GET() {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, description, is_system, created_at, role_permissions(id, permission_key, scope_type, scope_id)')
    .order('is_system', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: memberships } = await supabase.from('user_roles').select('role_id, user_id')
  const memberCounts: Record<string, number> = {}
  for (const m of memberships || []) {
    memberCounts[m.role_id] = (memberCounts[m.role_id] || 0) + 1
  }

  const withCounts = (roles || []).map((r) => ({ ...r, member_count: memberCounts[r.id] || 0 }))
  return NextResponse.json({ roles: withCounts })
}

// POST: Create a custom role. System roles (admin/staff/moderator/pupil/
// admin_assistant) are seeded once by migration 028 and never created
// here -- this is only for roles a firm defines for itself, e.g.
// "Conveyancing Lead" scoped to one practice area.
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const name = (body.name || '').trim()
  const description = (body.description || '').trim() || null

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const firmId = await getCurrentFirmId()
  if (!firmId) return NextResponse.json({ error: 'No firm found' }, { status: 404 })

  const supabase = createAdminClient()
  const { data: role, error } = await supabase
    .from('roles')
    .insert({ firm_id: firmId, name, description, is_system: false })
    .select('id, name, description, is_system, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A role named "${name}" already exists` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'roles',
    record_id: role.id,
    action: 'INSERT',
    new_data: { name, description },
    performed_by: guard.profile.id,
  })

  return NextResponse.json({ ...role, role_permissions: [], member_count: 0 }, { status: 201 })
}
