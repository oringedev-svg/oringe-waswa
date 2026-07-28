import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_matter_costs')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const supabase = createAdminClient()
  const { data: before } = await supabase.from('matter_fees').select('matter_id, amount, status').eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'Fee not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (typeof body.amount === 'number') updates.amount = body.amount
  if (body.status) updates.status = body.status
  if (body.recoverable !== undefined) updates.recoverable = body.recoverable
  if (body.vat_applicable !== undefined) updates.vat_applicable = body.vat_applicable
  if (body.vat_amount !== undefined) updates.vat_amount = body.vat_amount

  const { data, error } = await supabase.from('matter_fees').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'matter_fees', record_id: params.id, action: 'UPDATE', new_data: updates })
  try {
    if (updates.amount !== undefined && updates.amount !== before.amount) {
      await supabase.from('cost_history').insert({ matter_id: before.matter_id, matter_fee_id: params.id, old_amount: before.amount, new_amount: updates.amount, reason: body.reason || null, trigger: 'amount_changed', actor_id: guard.profile.id })
    } else if (updates.status !== undefined && updates.status !== before.status) {
      await supabase.from('cost_history').insert({ matter_id: before.matter_id, matter_fee_id: params.id, old_amount: before.amount, new_amount: before.amount, reason: `Status changed to ${updates.status}`, trigger: 'status_changed', actor_id: guard.profile.id })
    }
  } catch {}

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_matter_costs')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: before } = await supabase.from('matter_fees').select('matter_id, amount').eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'Fee not found' }, { status: 404 })

  const { error } = await supabase.from('matter_fees').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'matter_fees', record_id: params.id, action: 'DELETE' })
  try {
    await supabase.from('cost_history').insert({ matter_id: before.matter_id, matter_fee_id: null, old_amount: before.amount, new_amount: null, reason: 'Fee removed', trigger: 'deleted', actor_id: guard.profile.id })
  } catch {}

  return NextResponse.json({ success: true })
}
