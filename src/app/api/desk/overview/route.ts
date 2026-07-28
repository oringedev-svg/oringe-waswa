import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'

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
    return NextResponse.json({ teamMember: null, tasks: [], meetings: [], messages: [], permissions })
  }

  const now = new Date().toISOString()
  const [{ data: tasks }, { data: meetingRows }, { data: messages }] = await Promise.all([
    supabase
      .from('matter_tasks')
      .select('id, title, due_date, status, matter:legal_matters(id, matter_number, title), submission:submissions(id, tracking_code, submitter_name)')
      .eq('assigned_to', teamMember.id)
      .eq('status', 'open')
      .order('due_date', { ascending: true, nullsFirst: false }),
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

  return NextResponse.json({ teamMember, tasks: tasks || [], meetings, messages: messages || [], permissions })
}
