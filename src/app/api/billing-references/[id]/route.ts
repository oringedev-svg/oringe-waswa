import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_billing_references')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('billing_references')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_billing_references')
  if ('response' in guard) return guard.response

  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('billing_references')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  }

  const updates = {
    work_type: body.work_type ?? existing.work_type,
    billing_method: body.billing_method ?? existing.billing_method,
    default_value: body.default_value !== undefined ? body.default_value : existing.default_value,
    currency: body.currency ?? existing.currency,
    vat_profile: body.vat_profile ?? existing.vat_profile,
    tax_profile: body.tax_profile !== undefined ? body.tax_profile : existing.tax_profile,
    estimated_hours: body.estimated_hours !== undefined ? body.estimated_hours : existing.estimated_hours,
    estimated_duration_label: body.estimated_duration_label ?? existing.estimated_duration_label,
    active: body.active !== undefined ? body.active : existing.active,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('billing_references')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'billing_references',
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
  const guard = await requirePermissionApi('manage_billing_references')
  if ('response' in guard) return guard.response

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('billing_references')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('billing_references')
    .update({ active: false })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'billing_references',
    record_id: id,
    action: 'DELETE',
    old_data: existing,
  })

  return NextResponse.json({ success: true })
}
