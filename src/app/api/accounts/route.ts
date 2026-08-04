import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// The client-account console: every client account with its relationships
// (advocates via matter assignments, matters, invoices, conflict exposure,
// portal state) and DERIVED action flags, an account needs intervention
// because of what is true in the data, not because someone tagged it.
// Also returns "pre-accounts": website submissions from people who do not
// have an account yet, awaiting the review-and-create decision.

interface ActionReason { label: string; tone: 'risk' | 'warn' }

interface MatterRow {
  id: string
  matter_number: string
  title: string
  status: string
  updated_at: string | null
  assigned_attorney: { full_name: string } | null
}

export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)
  const ACTIVE = ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending', 'open', 'on_hold']

  const [{ data: clients }, { data: allProfiles }, { data: links }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, phone, user_id, created_at').eq('role', 'client').order('created_at', { ascending: false }),
    supabase.from('profiles').select('email'),
    supabase.from('matter_people').select('profile_id, matter_id'),
  ])

  const clientIds = new Set((clients || []).map((c) => c.id))
  const matterIdsByProfile = new Map<string, string[]>()
  for (const l of links || []) {
    if (!clientIds.has(l.profile_id)) continue
    const list = matterIdsByProfile.get(l.profile_id) || []
    list.push(l.matter_id)
    matterIdsByProfile.set(l.profile_id, list)
  }
  const allMatterIds = Array.from(new Set(Array.from(matterIdsByProfile.values()).flat()))

  const [{ data: matters }, { data: invoices }, { data: pendingConflicts }, { data: submissions }] = await Promise.all([
    allMatterIds.length > 0
      ? supabase.from('legal_matters').select('id, matter_number, title, status, updated_at, assigned_attorney:assigned_attorney_id(full_name)').in('id', allMatterIds)
      : Promise.resolve({ data: [] as never[] }),
    allMatterIds.length > 0
      ? supabase.from('invoices').select('matter_id, status, total, due_date').in('matter_id', allMatterIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as never[] }),
    allMatterIds.length > 0
      ? supabase.from('conflict_checks').select('matter_id').in('matter_id', allMatterIds).eq('decision', 'pending')
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from('submissions')
      .select('id, tracking_code, type, status, submitter_name, submitter_email, submitter_phone, created_at')
      .in('type', ['contact', 'appointment'])
      .in('status', ['pending', 'under_review', 'awaiting_info', 'on_hold'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  const matterRows = (matters || []) as unknown as MatterRow[]
  const matterById = new Map(matterRows.map((m) => [m.id, m]))
  const invoicesByMatter = new Map<string, { status: string; total: number; due_date: string | null }[]>()
  for (const inv of invoices || []) {
    const list = invoicesByMatter.get(inv.matter_id) || []
    list.push(inv)
    invoicesByMatter.set(inv.matter_id, list)
  }
  const conflictMatterIds = new Set((pendingConflicts || []).map((c) => c.matter_id))

  const accounts = (clients || []).map((c) => {
    const ids = matterIdsByProfile.get(c.id) || []
    const own = ids.map((id) => matterById.get(id)).filter(Boolean) as MatterRow[]

    const advocates = Array.from(new Set(own.map((m) => m.assigned_attorney?.full_name).filter((n): n is string => !!n)))
    let outstanding = 0
    let overdueInvoices = 0
    for (const id of ids) {
      for (const inv of invoicesByMatter.get(id) || []) {
        if (inv.status === 'sent') {
          outstanding += Number(inv.total)
          if (inv.due_date && inv.due_date < today) overdueInvoices++
        }
      }
    }
    const pendingConflictCount = ids.filter((id) => conflictMatterIds.has(id)).length
    const activeMatters = own.filter((m) => ACTIVE.includes(m.status))
    const stalled = activeMatters.filter((m) => m.updated_at && m.updated_at < sevenDaysAgo).length
    const unassigned = activeMatters.filter((m) => !m.assigned_attorney).length
    const leads = own.filter((m) => m.status === 'lead').length

    // Derived intervention flags, most serious first.
    const reasons: ActionReason[] = []
    if (pendingConflictCount > 0) reasons.push({ label: 'Conflict decision pending', tone: 'risk' })
    if (overdueInvoices > 0) reasons.push({ label: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`, tone: 'risk' })
    if (unassigned > 0) reasons.push({ label: 'No advocate assigned', tone: 'risk' })
    if (leads > 0) reasons.push({ label: 'Lead awaiting conflict check', tone: 'warn' })
    if (stalled > 0) reasons.push({ label: `${stalled} matter${stalled > 1 ? 's' : ''} stalled 7d+`, tone: 'warn' })

    const lastActivity = own.reduce<string>((acc, m) => (m.updated_at && m.updated_at > acc ? m.updated_at : acc), c.created_at)

    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      portal_active: !!c.user_id,
      created_at: c.created_at,
      advocates,
      matters: own.map((m) => ({ id: m.id, matter_number: m.matter_number, title: m.title, status: m.status })),
      activeMatters: activeMatters.length,
      pipelineMatters: own.filter((m) => ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending'].includes(m.status)).length,
      outstanding: Math.round(outstanding * 100) / 100,
      reasons,
      lastActivity,
    }
  })

  // Pre-accounts: open website requests from emails with no account of any
  // kind yet, the queue for the review-and-create decision.
  const knownEmails = new Set((allProfiles || []).map((p) => p.email?.toLowerCase()).filter(Boolean))
  const preAccounts = (submissions || []).filter((s) => !knownEmails.has(s.submitter_email?.toLowerCase()))

  return NextResponse.json({ accounts, preAccounts })
}
