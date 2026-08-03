import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

const TERMINAL = new Set(['Approved', 'Archived', 'Cancelled', 'Revoked', 'Rejected'])

// One reporting surface feeds the overview cards and charts; the browser
// receives aggregate-ready data rather than having to reconstruct firm-wide
// health from personal assignment lists.
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const supabase = createAdminClient()
  const [{ data: assignments, error }, { data: reviews }] = await Promise.all([
    supabase.from('assignments').select('id, status, health, due_date, assigned_to, submitted_at, assigned_at, started_at, completed_at, matter:legal_matters(id, title)'),
    supabase.from('reviews').select('assignment_id, reviewer_id, decided_at, decision, quality_score'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = assignments || []
  const now = Date.now()
  const open = rows.filter(row => !TERMINAL.has(row.status))
  const awaitingReview = rows.filter(row => row.status === 'Submitted').length
  const overdue = open.filter(row => row.due_date && new Date(row.due_date).getTime() < now).length
  const blocked = open.filter(row => row.health === 'BLOCKED').length
  const escalated = rows.filter(row => row.status === 'Escalated').length
  const byStatus = Object.entries(rows.reduce<Record<string, number>>((a, row) => { a[row.status] = (a[row.status] || 0) + 1; return a }, {})).map(([label, value]) => ({ label, value }))
  const byTeam = Object.entries(open.reduce<Record<string, number>>((a, row) => { const key = row.assigned_to || 'Unassigned'; a[key] = (a[key] || 0) + 1; return a }, {})).map(([teamMemberId, value]) => ({ teamMemberId, value }))
  const completed = rows.filter(row => row.completed_at && row.assigned_at)
  const avgCompletionHours = completed.length ? completed.reduce((sum, row) => sum + (new Date(row.completed_at!).getTime() - new Date(row.assigned_at).getTime()) / 3600000, 0) / completed.length : null
  const reviewDurations = (reviews || []).flatMap(review => {
    const assignment = rows.find(row => row.id === review.assignment_id)
    return review.decided_at && assignment?.submitted_at ? [(new Date(review.decided_at).getTime() - new Date(assignment.submitted_at).getTime()) / 3600000] : []
  })
  const avgReviewHours = reviewDurations.length ? reviewDurations.reduce((a, b) => a + b, 0) / reviewDurations.length : null
  const upcoming = open.filter(row => row.due_date).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 8)

  return NextResponse.json({
    metrics: { openWork: open.length, blocked, awaitingReview, overdue, escalated, avgCompletionHours, avgReviewHours, slaHealthPct: open.length ? Math.round(((open.length - overdue) / open.length) * 100) : 100 },
    byStatus, byTeam, upcoming,
  })
}
