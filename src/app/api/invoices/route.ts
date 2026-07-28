import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateInvoiceNumber, formatMinutes } from '@/lib/utils'

interface InvoiceItem {
  description: string
  amount: number
}

function computeTotals(items: InvoiceItem[], vatRate: number) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) * 100) / 100
  const vat_amount = Math.round(subtotal * (vatRate / 100) * 100) / 100
  return { subtotal, vat_amount, total: Math.round((subtotal + vat_amount) * 100) / 100 }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)

  if (searchParams.get('counts') === 'statuses') {
    const { data, error } = await supabase.from('invoices').select('status').is('deleted_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const counts: Record<string, number> = {}
    for (const row of data || []) counts[row.status] = (counts[row.status] || 0) + 1
    return NextResponse.json(counts)
  }

  const matterId = searchParams.get('matter_id')
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '30')

  let query = supabase
    .from('invoices')
    .select('*, matter:legal_matters(matter_number, title)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (matterId) query = query.eq('matter_id', matterId)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_billing')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { matter_id, from_time_entries, due_date, notes, client_kra_pin } = body
  const vatRate = typeof body.vat_rate === 'number' ? body.vat_rate : 16

  if (!matter_id) return NextResponse.json({ error: 'matter_id is required' }, { status: 400 })

  const { data: matter } = await supabase
    .from('legal_matters')
    .select('id, client_name, matter_number')
    .eq('id', matter_id)
    .single()
  if (!matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })

  let items: InvoiceItem[] = Array.isArray(body.items) ? body.items : []
  let sweptEntryIds: string[] = []

  // The default path: sweep the matter's unbilled billable time into line
  // items, snapshotting description/duration/rate as they stand right now.
  if (from_time_entries) {
    const { data: entries } = await supabase
      .from('time_entries')
      .select('id, description, entry_date, minutes, rate')
      .eq('matter_id', matter_id)
      .is('invoice_id', null)
      .is('deleted_at', null)
      .eq('billable', true)
      .order('entry_date', { ascending: true })

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: 'No unbilled time entries on this matter' }, { status: 400 })
    }

    items = entries.map((e) => ({
      description: `${e.entry_date}, ${e.description} (${formatMinutes(e.minutes)} @ ${e.rate}/hr)`,
      amount: Math.round((e.minutes / 60) * Number(e.rate) * 100) / 100,
    }))
    sweptEntryIds = entries.map((e) => e.id)
  }

  if (items.length === 0) return NextResponse.json({ error: 'An invoice needs at least one line item' }, { status: 400 })

  const totals = computeTotals(items, vatRate)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: generateInvoiceNumber(),
      matter_id,
      client_name: matter.client_name,
      client_kra_pin: client_kra_pin || null,
      items,
      vat_rate: vatRate,
      ...totals,
      due_date: due_date || null,
      notes: notes || null,
      created_by: guard.profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (sweptEntryIds.length > 0) {
    await supabase.from('time_entries').update({ invoice_id: invoice.id }).in('id', sweptEntryIds)
  }

  await logAudit({ table_name: 'invoices', record_id: invoice.id, action: 'INSERT', new_data: { matter_id, total: totals.total, entries: sweptEntryIds.length } })
  return NextResponse.json(invoice, { status: 201 })
}
