import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// One call computes the state of the whole practice as a flow:
// Website (inquiries in) -> Clients (matters through the pipeline) ->
// Staff (who carries the work) -> Finance (work out as cash).
// The "attention" list is the orchestration layer: every item is a handoff
// that is currently waiting on a human decision.
export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const today = now.toISOString().slice(0, 10)

  const [
    pendingSubs,
    newSubs,
    subscribers,
    publishedPosts,
    matterRows,
    pendingConflicts,
    unbilledEntries,
    invoiceRows,
    staffProfiles,
    portalClients,
    teamCount,
  ] = await Promise.all([
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo).is('deleted_at', null),
    supabase.from('mail_subscribers').select('id', { count: 'exact', head: true }),
    supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('legal_matters').select('status, assigned_attorney_id, updated_at'),
    supabase.from('conflict_checks').select('id', { count: 'exact', head: true }).eq('decision', 'pending'),
    supabase.from('time_entries').select('minutes, rate').is('invoice_id', null).eq('billable', true).is('deleted_at', null),
    supabase.from('invoices').select('status, total, due_date, paid_at').is('deleted_at', null),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'staff', 'moderator']),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').not('user_id', 'is', null),
    supabase.from('team_members').select('id', { count: 'exact', head: true }),
  ])

  // --- Clients and Matters: pipeline shape and stalled work ---
  const matters = matterRows.data || []
  const stageCounts: Record<string, number> = {}
  let stalled = 0
  let unassignedActive = 0
  const ACTIVE = ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending', 'open', 'on_hold']
  for (const m of matters) {
    stageCounts[m.status] = (stageCounts[m.status] || 0) + 1
    if (ACTIVE.includes(m.status)) {
      if (m.updated_at && m.updated_at < sevenDaysAgo) stalled++
      if (!m.assigned_attorney_id) unassignedActive++
    }
  }
  const pipeline = (stageCounts['lead'] || 0) + (stageCounts['conflict_check'] || 0) + (stageCounts['engagement_letter'] || 0) + (stageCounts['retainer_pending'] || 0)
  const activeMatters = (stageCounts['open'] || 0) + (stageCounts['on_hold'] || 0)

  // --- Finance: work not yet billed, billed not yet paid ---
  const unbilledTotal = (unbilledEntries.data || []).reduce((s, e) => s + (e.minutes / 60) * Number(e.rate), 0)
  const invoices = invoiceRows.data || []
  let outstanding = 0
  let overdueInvoices = 0
  let collectedThisMonth = 0
  for (const inv of invoices) {
    if (inv.status === 'sent') {
      outstanding += Number(inv.total)
      if (inv.due_date && inv.due_date < today) overdueInvoices++
    }
    if (inv.status === 'paid' && inv.paid_at && inv.paid_at >= monthStart) collectedThisMonth += Number(inv.total)
  }

  // --- The attention queue: handoffs waiting on a decision ---
  const attention: { label: string; count: number; href: string; tone: 'risk' | 'warn' }[] = []
  if ((pendingSubs.count || 0) > 0) attention.push({ label: 'new inquiries awaiting triage', count: pendingSubs.count!, href: '/admin/submissions', tone: 'warn' })
  if ((stageCounts['lead'] || 0) > 0) attention.push({ label: 'leads awaiting a conflict check', count: stageCounts['lead'], href: '/admin/matters', tone: 'warn' })
  if ((pendingConflicts.count || 0) > 0) attention.push({ label: 'conflict checks awaiting a partner decision', count: pendingConflicts.count!, href: '/admin/matters', tone: 'risk' })
  if (unassignedActive > 0) attention.push({ label: 'active matters with no attorney assigned', count: unassignedActive, href: '/admin/matters', tone: 'risk' })
  if (stalled > 0) attention.push({ label: 'matters with no activity in 7+ days', count: stalled, href: '/admin/matters', tone: 'warn' })
  if (overdueInvoices > 0) attention.push({ label: 'invoices past their due date', count: overdueInvoices, href: '/admin/invoices', tone: 'risk' })

  return NextResponse.json({
    attention,
    website: {
      newInquiries7d: newSubs.count || 0,
      pendingTriage: pendingSubs.count || 0,
      subscribers: subscribers.count || 0,
      publishedPosts: publishedPosts.count || 0,
    },
    clients: {
      pipeline,
      activeMatters,
      stalled,
      stageCounts,
      portalClients: portalClients.count || 0,
    },
    staff: {
      staffAccounts: staffProfiles.count || 0,
      teamMembers: teamCount.count || 0,
      unassignedActive,
    },
    finance: {
      unbilledTotal: Math.round(unbilledTotal * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      collectedThisMonth: Math.round(collectedThisMonth * 100) / 100,
      overdueInvoices,
    },
  })
}
