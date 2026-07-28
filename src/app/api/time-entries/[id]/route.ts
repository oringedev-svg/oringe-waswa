import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// A time entry that has been swept into an invoice is frozen, the invoice
// is a financial record of exactly what was billed. Void the invoice first
// to release its entries.
async function getEditableEntry(id: string) {
  const supabase = createAdminClient()
  const { data: entry } = await supabase
    .from('time_entries')
    .select('id, invoice_id, deleted_at')
    .eq('id', id)
    .single()
  if (!entry || entry.deleted_at) return { error: 'Time entry not found', status: 404 }
  if (entry.invoice_id) return { error: 'This entry is on an invoice and cannot be changed. Void the invoice to release it.', status: 400 }
  return { entry }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('log_time')
  if ('response' in guard) return guard.response

  const check = await getEditableEntry(params.id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  for (const key of ['description', 'entry_date', 'minutes', 'rate', 'billable']) {
    if (key in body) allowed[key] = body[key]
  }
  if (typeof allowed.minutes === 'number' && allowed.minutes <= 0) {
    return NextResponse.json({ error: 'minutes must be positive' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*, author:profiles(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'time_entries', record_id: params.id, action: 'UPDATE', new_data: allowed })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('log_time')
  if ('response' in guard) return guard.response

  const check = await getEditableEntry(params.id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('time_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'time_entries', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
