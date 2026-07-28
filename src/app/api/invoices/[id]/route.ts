import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { canTransitionInvoice, type InvoiceStatus } from '@/lib/invoiceLifecycle'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, matter:legal_matters(matter_number, title), creator:profiles(full_name)')
    .eq('id', params.id)
    .single()
  if (error || !data || data.deleted_at) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_billing')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  const { data: current } = await supabase
    .from('invoices')
    .select('id, status, deleted_at')
    .eq('id', params.id)
    .single()
  if (!current || current.deleted_at) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const fromStatus = current.status as InvoiceStatus
  const toStatus = body.status as InvoiceStatus | undefined
  const isTransition = toStatus !== undefined && toStatus !== fromStatus

  const update: Record<string, unknown> = {}

  // Content edits (due date, notes, KRA PIN) are only allowed while draft,   // a sent invoice is a fixed financial record.
  for (const key of ['due_date', 'notes', 'client_kra_pin']) {
    if (key in body) {
      if (fromStatus !== 'draft') {
        return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 400 })
      }
      update[key] = body[key]
    }
  }

  if (isTransition) {
    if (!canTransitionInvoice(fromStatus, toStatus!)) {
      return NextResponse.json({ error: `Cannot move an invoice from "${fromStatus}" to "${toStatus}"` }, { status: 400 })
    }
    update.status = toStatus
    if (toStatus === 'sent') update.issued_at = new Date().toISOString()
    if (toStatus === 'paid') update.paid_at = new Date().toISOString()
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoices')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Voiding an invoice releases its time entries back to unbilled, the
  // work still happened and can be billed again on a corrected invoice.
  if (isTransition && toStatus === 'void') {
    await supabase.from('time_entries').update({ invoice_id: null }).eq('invoice_id', params.id)
  }

  await logAudit({ table_name: 'invoices', record_id: params.id, action: 'UPDATE', new_data: update })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_billing')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: current } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('id', params.id)
    .single()
  if (!current) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (current.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted, void issued invoices instead' }, { status: 400 })
  }

  // Deleting a draft releases its time entries, same as voiding.
  await supabase.from('time_entries').update({ invoice_id: null }).eq('invoice_id', params.id)

  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'invoices', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
