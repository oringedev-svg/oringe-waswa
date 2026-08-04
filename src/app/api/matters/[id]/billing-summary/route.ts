import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { id } = await params

  // Matter owner reviews billing on their own matters, not just Finance;
  // scope by matter access rather than gating behind manage_billing.
  const scope = await getMatterAccessScope(guard.profile)
  if (!canAccessMatter(scope, id)) {
    return NextResponse.json({ error: 'Not authorized for this matter' }, { status: 403 })
  }

  const supabase = createAdminClient()

  // Get all assignments for the matter with billing data
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('id, estimated_value, billing_status')
    .eq('matter_id', id)
    .is('deleted_at', null)

  if (assignmentsError) {
    return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
  }

  // Get invoices for the matter
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id, total, status')
    .eq('matter_id', id)
    .is('deleted_at', null)

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 })
  }

  // Calculate billing summary
  let estimated_work = 0
  let approved_work = 0
  let completed_work = 0

  for (const assignment of assignments || []) {
    const value = assignment.estimated_value || 0
    if (value > 0) {
      estimated_work += value

      if (assignment.billing_status === 'APPROVED' || assignment.billing_status === 'SENT_TO_FINANCE' || assignment.billing_status === 'BILLED') {
        approved_work += value
      }

      if (assignment.billing_status === 'BILLED') {
        completed_work += value
      }
    }
  }

  let invoiced = 0
  let collected = 0
  let outstanding = 0

  for (const invoice of invoices || []) {
    invoiced += invoice.total || 0
    if (invoice.status === 'paid' || invoice.status === 'partially_paid') {
      collected += invoice.total || 0
    }
    if (invoice.status !== 'paid') {
      outstanding += invoice.total || 0
    }
  }

  return NextResponse.json({
    estimated_work,
    approved_work,
    outstanding_work: Math.max(0, approved_work - invoiced),
    invoiced,
    collected,
    outstanding,
    assignment_count: assignments?.length || 0,
    invoice_count: invoices?.length || 0,
  })
}
