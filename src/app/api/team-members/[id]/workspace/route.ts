import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

const ACTIVE = new Set(['Assigned', 'Accepted', 'In Progress', 'Submitted'])

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const supabase = createAdminClient()
  const { data: member, error: memberError } = await supabase.from('team_members').select('id, full_name, position, profile_id').eq('id', params.id).single()
  if (memberError || !member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  const [{ data: assignments }, { data: reviews }, { data: timeline }] = await Promise.all([
    supabase.from('assignments').select('id, instructions, status, health, due_date, assigned_at, completed_at, matter:legal_matters(id, matter_number, title), dependencies:assignment_dependencies(depends_on_assignment_id, dependency_type, status)').eq('assigned_to', member.id).order('assigned_at', { ascending: false }),
    supabase.from('reviews').select('decision, quality_score, decided_at, assignment:assignments!reviews_assignment_id_fkey(assigned_to, submitted_at)').eq('reviewer_id', member.profile_id),
    supabase.from('assignment_timeline_entries').select('created_at').eq('actor_id', member.profile_id).order('created_at', { ascending: false }).limit(365),
  ])
  const rows = assignments || []
  const now = Date.now()
  const active = rows.filter(row => ACTIVE.has(row.status))
  const overdue = active.filter(row => row.due_date && new Date(row.due_date).getTime() < now).length
  const completed = rows.filter(row => row.completed_at)
  const completedThisMonth = completed.filter(row => new Date(row.completed_at!).getMonth() === new Date().getMonth() && new Date(row.completed_at!).getFullYear() === new Date().getFullYear()).length
  const activityByDay = (timeline || []).reduce<Record<string, number>>((all, item) => { const day = item.created_at.slice(0, 10); all[day] = (all[day] || 0) + 1; return all }, {})
  const qualityScores = (reviews || []).flatMap(review => review.quality_score ? [review.quality_score] : [])
  const pendingReviews = (reviews || []).filter(review => !review.decided_at).length
  return NextResponse.json({
    member,
    capacity: { active: active.length, overdue, completedThisMonth, pendingReviews, avgReviewScore: qualityScores.length ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : null },
    currentWork: active,
    recentlyCompleted: completed.slice(0, 10),
    reviewHistory: reviews || [],
    activityByDay,
  })
}
