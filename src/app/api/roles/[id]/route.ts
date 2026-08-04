import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('roles').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  if (existing.is_system) {
    return NextResponse.json({ error: 'System roles cannot be renamed or redescribed' }, { status: 400 })
  }

  const updates = {
    name: body.name !== undefined ? String(body.name).trim() : existing.name,
    description: body.description !== undefined ? String(body.description).trim() || null : existing.description,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('roles').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'roles', record_id: id, action: 'UPDATE', old_data: existing, new_data: updates, performed_by: guard.profile.id })
  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('roles').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Role not found' }, { status: 404 })
  if (existing.is_system) {
    return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 })
  }

  const { count } = await supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role_id', id)
  if (count && count > 0) {
    return NextResponse.json(
      { error: `${count} ${count === 1 ? 'person is' : 'people are'} still assigned to this role. Remove them first.` },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'roles', record_id: id, action: 'DELETE', old_data: existing, performed_by: guard.profile.id })
  return NextResponse.json({ success: true })
}
