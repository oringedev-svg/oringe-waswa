import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_operations')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('activity_types')
    .select('*, billing_reference:billing_references(*)')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Activity type not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_operations')
  if ('response' in guard) return guard.response

  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('activity_types')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Activity type not found' }, { status: 404 })
  }

  const updates = {
    name: body.name ?? existing.name,
    category: body.category ?? existing.category,
    description: body.description !== undefined ? body.description : existing.description,
    default_due_days: body.default_due_days !== undefined ? body.default_due_days : existing.default_due_days,
    billing_reference_id: body.billing_reference_id !== undefined ? body.billing_reference_id : existing.billing_reference_id,
    is_active: body.is_active !== undefined ? body.is_active : existing.is_active,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('activity_types')
    .update(updates)
    .eq('id', id)
    .select('*, billing_reference:billing_references(id, work_type)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'activity_types',
    record_id: id,
    action: 'UPDATE',
    old_data: existing,
    new_data: updates,
  })

  return NextResponse.json(data)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_operations')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('activity_types')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Activity type not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('activity_types')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'activity_types',
    record_id: id,
    action: 'DELETE',
    old_data: existing,
  })

  return NextResponse.json({ success: true })
}
