import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { buildIcsInvite, meetingInviteEmail } from '@/lib/ics'
import { resolveAttendees } from '@/lib/attendeeResolver'

interface AttendeeInput {
  team_member_id?: string
  profile_id?: string
  external_name?: string
  external_email?: string
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const matterId = searchParams.get('matter_id')
  const submissionId = searchParams.get('submission_id')

  let query = supabase
    .from('calendar_events')
    .select('*, creator:profiles(full_name), matter:legal_matters(matter_number, title), submission:submissions(tracking_code, submitter_name), attendees:calendar_event_attendees(*, team_member:team_members(full_name, avatar_url), profile:profiles(full_name, email))')
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true })

  if (from) query = query.gte('start_at', from)
  if (to) query = query.lte('start_at', to)
  if (matterId) query = query.eq('matter_id', matterId)
  if (submissionId) query = query.eq('submission_id', submissionId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { title, description, type, start_at, end_at, location, meeting_link, matter_id, submission_id, job_application_id, attendees } = body as {
    title: string; description?: string; type?: string; start_at: string; end_at: string
    location?: string; meeting_link?: string; matter_id?: string; submission_id?: string; job_application_id?: string
    attendees?: AttendeeInput[]
  }

  if (!title || !start_at || !end_at) {
    return NextResponse.json({ error: 'title, start_at, and end_at are required' }, { status: 400 })
  }
  if (new Date(end_at) <= new Date(start_at)) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert({
      title, description: description || null, type: type || 'meeting', start_at, end_at,
      location: location || null, meeting_link: meeting_link || null,
      matter_id: matter_id || null, submission_id: submission_id || null,
      // This is a recruitment-only column introduced in migration 037. Do
      // not name it for ordinary meetings: a database still awaiting that
      // migration must be able to schedule normal staff events.
      ...(job_application_id ? { job_application_id } : {}),
      created_by: guard.profile.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve every attendee to a real name + email, whether they're internal
  // staff, a client with a profile, or someone with no account at all.
  // Batched in exactly two queries via resolveAttendees(); was previously a
  // sequential per-attendee loop (a meeting with a dozen invitees fired
  // twenty-plus round trips).
  const resolved = await resolveAttendees<AttendeeInput>(attendees || [])

  let insertedAttendees: { id: string }[] = []
  if (resolved.length > 0) {
    const { data: inserted } = await supabase
      .from('calendar_event_attendees')
      .insert(
        resolved.map((r) => ({
          event_id: event.id,
          team_member_id: r.row.team_member_id || null,
          profile_id: r.row.profile_id || null,
          external_name: r.row.external_name || null,
          external_email: r.row.external_email || null,
        }))
      )
      .select('id')
    insertedAttendees = inserted || []
  }

  // Notify everyone with a calendar invite they can add anywhere. Best
  // effort, a mail failure never blocks the meeting from being created.
  try {
    const organizerName = guard.profile.fullName
    const ics = buildIcsInvite({
      uid: `${event.id}@oringewaswa`,
      title, description, location,
      startAt: start_at, endAt: end_at,
      organizer: { name: organizerName, email: process.env.EMAIL_USER || 'no-reply@oringewaswa.co.ke' },
      attendees: resolved.map((r) => ({ name: r.name, email: r.email })),
    })
    const html = meetingInviteEmail({ title, description, location, meetingLink: meeting_link, startAt: start_at, endAt: end_at, organizerName })
    await Promise.all(
      resolved.map((r, i) => {
        const attendeeId = insertedAttendees[i]?.id
        return sendEmail({
          to: r.email,
          subject: `Invitation: ${title}`,
          html,
          attachments: [{ filename: 'invite.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }],
        })
          .then(() => {
            if (attendeeId) return supabase.from('calendar_event_attendees').update({ notified_at: new Date().toISOString() }).eq('id', attendeeId)
          })
          .catch(() => {})
      })
    )
  } catch {}

  await logAudit({ table_name: 'calendar_events', record_id: event.id, action: 'INSERT', new_data: { title, start_at, attendees: resolved.length } })
  return NextResponse.json(event, { status: 201 })
}
