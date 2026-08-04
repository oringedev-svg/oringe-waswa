import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'
import { resolveHolidaysForYear, type ResolvedHoliday } from '@/lib/holidayDates'

// Holidays are firm-wide, not per-person, and the rule set changes about
// once a year -- so they're resolved once per request rather than being
// worth their own round trip from the client. Covers this year and next so
// a calendar paged into December/January doesn't go blank.
async function loadHolidays(supabase: ReturnType<typeof createAdminClient>): Promise<ResolvedHoliday[]> {
  try {
    const year = new Date().getFullYear()
    const [{ data: rules }, { data: overrides }] = await Promise.all([
      supabase.from('public_holidays').select('name, calculation_rule, month, day, is_non_working_day, is_active').eq('country_code', 'KE'),
      supabase.from('public_holiday_overrides').select('observed_on, name, is_non_working_day').eq('country_code', 'KE'),
    ])

    const resolved = [
      ...resolveHolidaysForYear(rules || [], year),
      ...resolveHolidaysForYear(rules || [], year + 1),
      // Gazette-declared and lunar dates can't be computed; the override
      // table is where their real dates live once announced.
      ...(overrides || []).map((o) => ({
        date: String(o.observed_on).slice(0, 10),
        name: o.name as string,
        isNonWorkingDay: o.is_non_working_day as boolean,
      })),
    ]

    // An override for a date a rule already produced should win, not double up.
    const byDate = new Map<string, ResolvedHoliday>()
    for (const h of resolved) byDate.set(`${h.date}|${h.name}`, h)
    return Array.from(byDate.values())
  } catch {
    // A desk that loads without holiday shading beats one that doesn't load.
    return []
  }
}

export const dynamic = 'force-dynamic'

interface DeskEvent {
  id: string
  title: string
  type: string
  start_at: string
  end_at: string
  location: string | null
  meeting_link: string | null
  status: string
}

// "My Desk", the restricted, personal view for anyone whose job doesn't
// need the full admin: what's assigned to me, what I'm attending, what's
// been sent to me. Works for any internal role, but it's the whole world
// for a pupil or administrative assistant who has few or no permissions
// granted yet.
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, full_name, position, seniority')
    .eq('profile_id', profile.id)
    .maybeSingle()

  const permissions = Array.from(await getUserPermissions(profile.userId, profile.role))

  if (!teamMember) {
    // No linked team profile yet, permissions can still work, but there's
    // no assignee identity for tasks/meetings/messages to resolve against.
    // reviewQueue must still be included: the desk page reads
    // data.reviewQueue.length unconditionally, omitting it here crashed
    // the whole page for exactly this case (a profile with no team_members
    // row yet) with a bare client-side exception and no hint why.
    // Holidays still apply to someone with no team profile yet -- they're
    // firm-wide, not assigned.
    return NextResponse.json({ teamMember: null, tasks: [], reviewQueue: [], meetings: [], messages: [], permissions, holidays: await loadHolidays(supabase) })
  }

  const now = new Date().toISOString()
  const [{ data: assignments }, { data: submittedForReview }, { data: meetingRows }, { data: messages }] = await Promise.all([
    // Assignments is the single work-tracking system (matter_tasks is
    // deprecated), a work item stays "open" on the desk through Assigned,
    // Accepted, and In Progress, it drops off once submitted for review.
    supabase
      .from('assignments')
      .select('id, instructions, status, assigned_at, due_date, submission_id, matter:legal_matters(id, matter_number, title, type, submission_id)')
      .eq('assigned_to', teamMember.id)
      .in('status', ['Assigned', 'Accepted', 'In Progress'])
      .order('due_date', { ascending: true, nullsFirst: false }),
    // The other side of the same coin: work THIS person handed out that's
    // now sitting Submitted, waiting on their approve/reject decision.
    // Nothing surfaced this before, an assigner had no way to discover a
    // submission short of already knowing to check /admin/assignments.
    supabase
      .from('assignments')
      .select('id, instructions, status, submitted_at, due_date, submission_id, assignee:assigned_to(full_name), matter:legal_matters(id, matter_number, title, type, submission_id)')
      .eq('assigned_by', profile.id)
      .eq('status', 'Submitted')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('calendar_event_attendees')
      .select('event:calendar_events(id, title, type, start_at, end_at, location, meeting_link, status)')
      .eq('team_member_id', teamMember.id),
    supabase
      .from('team_messages')
      .select('id, subject, content, is_broadcast, is_read, created_at, sender:team_members!team_messages_sender_id_fkey(full_name)')
      .or(`recipient_id.eq.${teamMember.id},is_broadcast.eq.true`)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const meetings = ((meetingRows || []) as unknown as { event: DeskEvent | null }[])
    .map((r) => r.event)
    .filter((e): e is DeskEvent => !!e && e.status !== 'cancelled' && e.start_at >= now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  // An assignment may point at a submission directly (pre-matter intake
  // work) and/or, once promoted, at the matter that submission became,
  // fetched separately since Supabase can't follow that second hop in one
  // select.
  type AssignmentRow = { id: string; instructions: string | null; status: string; due_date: string | null; submission_id: string | null; matter: { id: string; matter_number: string; title: string; type: string; submission_id: string | null } | null }
  type ReviewRow = AssignmentRow & { assignee?: { full_name: string } | null }
  const rows = (assignments || []) as unknown as AssignmentRow[]
  const reviewRows = (submittedForReview || []) as unknown as ReviewRow[]
  const submissionIds = Array.from(new Set(
    [...rows, ...reviewRows].flatMap((r) => [r.submission_id, r.matter?.submission_id]).filter((v): v is string => !!v)
  ))
  const submissionsById = new Map<string, { id: string; tracking_code: string; submitter_name: string }>()
  if (submissionIds.length > 0) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, tracking_code, submitter_name')
      .in('id', submissionIds)
    for (const s of subs || []) submissionsById.set(s.id, s)
  }

  function toTask(r: AssignmentRow) {
    const submissionId = r.submission_id || r.matter?.submission_id || null
    return {
      id: r.id,
      title: r.instructions || 'Assignment',
      status: r.status,
      due_date: r.due_date,
      matter: r.matter ? { id: r.matter.id, matter_number: r.matter.matter_number, title: r.matter.title, type: r.matter.type } : null,
      submission: submissionId ? submissionsById.get(submissionId) || null : null,
    }
  }

  const tasks = rows.map(toTask)
  const reviewQueue = reviewRows.map((r) => ({ ...toTask(r), assigneeName: r.assignee?.full_name || null }))

  return NextResponse.json({ teamMember, tasks, reviewQueue, meetings, messages: messages || [], permissions, holidays: await loadHolidays(supabase) })
}
