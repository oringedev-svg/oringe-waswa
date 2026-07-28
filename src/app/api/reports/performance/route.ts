import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { MATTER_TYPES } from '@/lib/utils'

// ============================================================
// FIRM PERFORMANCE REPORT
// ============================================================
// One aggregation pass over matters/invoices/time entries, computed in
// memory rather than N separate queries per tab, a firm's row counts here
// are in the hundreds, not a scale that needs a database-side rollup.
// Nothing here is stored; it's a read of what already exists on matters,
// invoices, and time entries.

const TERMINAL_STATUSES = ['closed', 'archived', 'declined']
const BILLED_STATUSES = ['sent', 'paid']
const TYPE_LABEL: Record<string, string> = Object.fromEntries(MATTER_TYPES.map((t) => [t.value, t.label]))

function typeLabel(type: string | null) {
  return TYPE_LABEL[type || 'other'] || type || 'Other'
}

function timeValue(minutes: number, rate: number) {
  return (minutes / 60) * rate
}

export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()

  const [{ data: matters }, { data: invoices }, { data: timeEntries }, { data: team }] = await Promise.all([
    supabase.from('legal_matters').select('id, matter_number, type, status, opening_date, assigned_attorney_id'),
    supabase.from('invoices').select('id, invoice_number, matter_id, client_name, status, total, due_date, paid_at').is('deleted_at', null),
    supabase.from('time_entries').select('id, matter_id, profile_id, minutes, rate, billable, invoice_id').is('deleted_at', null),
    supabase.from('team_members').select('id, full_name, profile_id').eq('is_active', true),
  ])

  const M = matters || []
  const I = invoices || []
  const T = timeEntries || []
  const TEAM = team || []

  const currentYear = new Date().getFullYear()
  const today = new Date()

  // ---- Overview ----
  const mattersYtd = M.filter((m) => new Date(m.opening_date).getFullYear() === currentYear).length
  const mattersActive = M.filter((m) => !TERMINAL_STATUSES.includes(m.status)).length

  const totalBilled = I.filter((i) => BILLED_STATUSES.includes(i.status)).reduce((s, i) => s + Number(i.total), 0)
  const collected = I.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const outstanding = Math.max(0, totalBilled - collected)
  const overdue = I.filter((i) => i.status === 'sent' && i.due_date && new Date(i.due_date) < today).reduce((s, i) => s + Number(i.total), 0)
  const collectionRate = totalBilled > 0 ? (collected / totalBilled) * 100 : 0

  const billableEntries = T.filter((t) => t.billable)
  const workedValue = billableEntries.reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
  const billedTimeValue = billableEntries.filter((t) => t.invoice_id).reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
  const avgRealization = workedValue > 0 ? (billedTimeValue / workedValue) * 100 : 0

  const wipEntries = billableEntries.filter((t) => !t.invoice_id)
  const wipHours = wipEntries.reduce((s, t) => s + t.minutes, 0) / 60
  const wipValue = wipEntries.reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)

  // ---- Pipeline by practice area (active matters) ----
  const activeByType = new Map<string, number>()
  for (const m of M) {
    if (TERMINAL_STATUSES.includes(m.status)) continue
    activeByType.set(m.type, (activeByType.get(m.type) || 0) + 1)
  }
  const pipelineByType = Array.from(activeByType.entries())
    .map(([type, count]) => ({ type, label: typeLabel(type), count }))
    .sort((a, b) => b.count - a.count)

  // ---- By practice area (all matters, financials + realization) ----
  const types = Array.from(new Set(M.map((m) => m.type)))
  const byPracticeArea = types.map((type) => {
    const matterIds = new Set(M.filter((m) => m.type === type).map((m) => m.id))
    const typeInvoices = I.filter((i) => i.matter_id && matterIds.has(i.matter_id))
    const typeEntries = billableEntries.filter((t) => matterIds.has(t.matter_id))
    const worked = typeEntries.reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
    const billedTime = typeEntries.filter((t) => t.invoice_id).reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
    return {
      type,
      label: typeLabel(type),
      matterCount: matterIds.size,
      billed: typeInvoices.filter((i) => BILLED_STATUSES.includes(i.status)).reduce((s, i) => s + Number(i.total), 0),
      collected: typeInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
      wipValue: typeEntries.filter((t) => !t.invoice_id).reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0),
      realization: worked > 0 ? (billedTime / worked) * 100 : 0,
    }
  }).sort((a, b) => b.matterCount - a.matterCount)

  // ---- By advocate ----
  const byAdvocate = TEAM
    .map((member) => {
      const matterIds = new Set(M.filter((m) => m.assigned_attorney_id === member.id).map((m) => m.id))
      const memberInvoices = I.filter((i) => i.matter_id && matterIds.has(i.matter_id))
      const memberEntries = billableEntries.filter((t) => t.profile_id === member.profile_id)
      const worked = memberEntries.reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
      const billedTime = memberEntries.filter((t) => t.invoice_id).reduce((s, t) => s + timeValue(t.minutes, Number(t.rate)), 0)
      return {
        id: member.id,
        name: member.full_name,
        matterCount: matterIds.size,
        hoursLogged: memberEntries.reduce((s, t) => s + t.minutes, 0) / 60,
        billed: memberInvoices.filter((i) => BILLED_STATUSES.includes(i.status)).reduce((s, i) => s + Number(i.total), 0),
        collected: memberInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
        realization: worked > 0 ? (billedTime / worked) * 100 : 0,
      }
    })
    .filter((a) => a.matterCount > 0 || a.hoursLogged > 0)
    .sort((a, b) => b.billed - a.billed)

  // ---- Ageing (unpaid, issued invoices) ----
  const unpaid = I.filter((i) => i.status === 'sent')
  const bucketFor = (i: (typeof unpaid)[number]) => {
    if (!i.due_date) return 'Current'
    const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000)
    if (days <= 0) return 'Current'
    if (days <= 30) return '1-30'
    if (days <= 60) return '31-60'
    if (days <= 90) return '61-90'
    return '90+'
  }
  const bucketOrder = ['Current', '1-30', '31-60', '61-90', '90+']
  const bucketMap = new Map<string, { count: number; total: number }>()
  for (const label of bucketOrder) bucketMap.set(label, { count: 0, total: 0 })
  const ageingInvoices: { id: string; invoice_number: string; client_name: string; due_date: string | null; daysOverdue: number; total: number }[] = []
  for (const i of unpaid) {
    const label = bucketFor(i)
    const b = bucketMap.get(label)!
    b.count += 1
    b.total += Number(i.total)
    const days = i.due_date ? Math.floor((today.getTime() - new Date(i.due_date).getTime()) / 86400000) : 0
    if (days > 0) {
      ageingInvoices.push({ id: i.id, invoice_number: i.invoice_number, client_name: i.client_name, due_date: i.due_date, daysOverdue: days, total: Number(i.total) })
    }
  }
  ageingInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue)

  return NextResponse.json({
    overview: { mattersYtd, mattersActive, collectionRate, avgRealization, wipHours, wipValue },
    billing: { totalBilled, collected, outstanding, overdue },
    pipelineByType,
    byPracticeArea,
    byAdvocate,
    ageing: { buckets: bucketOrder.map((label) => ({ label, ...bucketMap.get(label)! })), invoices: ageingInvoices },
  })
}
