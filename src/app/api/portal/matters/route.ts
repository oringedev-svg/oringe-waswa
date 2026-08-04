import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { clientStageMeta } from '@/lib/clientStage'

// The client's own view of their matters. Everything returned here is
// written for the client: internal stage names, conflict checks, internal
// notes, and staff-only documents never cross this boundary.
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: links } = await supabase
    .from('matter_people')
    .select('matter_id')
    .eq('profile_id', profile.id)

  const matterIds = (links || []).map((l) => l.matter_id)
  if (matterIds.length === 0) return NextResponse.json({ data: [] })

  const [{ data: matters }, { data: docs }, { data: invoices }] = await Promise.all([
    supabase
      .from('legal_matters')
      .select('id, matter_number, title, type, status, opening_date, assigned_attorney:assigned_attorney_id(full_name, position)')
      .in('id', matterIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('legal_documents')
      .select('id, matter_id, title, file_url, file_name, file_size, created_at')
      .in('matter_id', matterIds)
      .in('access_level', ['public', 'client'])
      .order('created_at', { ascending: false }),
    // Clients only ever see issued invoices, drafts and voided ones are
    // internal working state.
    supabase
      .from('invoices')
      .select('id, matter_id, invoice_number, status, total, due_date, issued_at, items, subtotal, vat_rate, vat_amount')
      .in('matter_id', matterIds)
      .in('status', ['sent', 'paid'])
      .is('deleted_at', null)
      .order('issued_at', { ascending: false }),
  ])

  const data = (matters || []).map((m) => ({
    id: m.id,
    matter_number: m.matter_number,
    title: m.title,
    type: m.type,
    stage: clientStageMeta(m.status),
    opening_date: m.opening_date,
    attorney: m.assigned_attorney,
    documents: (docs || []).filter((d) => d.matter_id === m.id),
    invoices: (invoices || []).filter((i) => i.matter_id === m.id),
  }))

  return NextResponse.json({ data })
}
