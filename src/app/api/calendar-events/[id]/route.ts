import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { buildIcsInvite, meetingInviteEmail } from '@/lib/ics'
import { resolveAttendees } from '@/lib/attendeeResolver'
import { buildLocationSummary } from '@/lib/meetingProviders'
import { syncEventUpdated, syncEventCancelled } from '@/lib/calendarSync'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*, creator:profiles(full_name), matter:legal_matters(matter_number, title), submission:submissions(tracking_code, submitter_name), attendees:calendar_event_attendees(*, team_member:team_members(full_name, avatar_url), profile:profiles(full_name, email))')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  for (const key of [
    'title', 'description', 'type', 'start_at', 'end_at', 'location', 'meeting_link', 'status',
    'meeting_provider', 'venue_name', 'building', 'room', 'address', 'location_notes',
  ]) {
    if (key in body) allowed[key] = body[key]
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  // `location` is derived from the venue fields, so moving a meeting to a
  // different room has to rewrite the summary line every downstream reader
  // (the .ics, the invite email) actually uses.
  const venueTouched = ['venue_name', 'building', 'room', 'address'].some((k) => k in allowed)
  if (venueTouched && !('location' in body)) {
    const summary = buildLocationSummary({
      venue_name: allowed.venue_name as string | null,
      building: allowed.building as string | null,
      room: allowed.room as string | null,
      address: allowed.address as string | null,
    })
    if (summary) allowed.location = summary
  }

  const rescheduled = 'start_at' in allowed || 'end_at' in allowed

  const { data, error } = await supabase
    .from('calendar_events')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*, attendees:calendar_event_attendees(*)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A reschedule or cancellation is exactly the kind of change attendees
  // need to actually see on their own calendar, not just in this app, so
  // it gets a fresh .ics (calendar apps update the same event by UID).
  if (rescheduled || allowed.status === 'cancelled') {
    try {
      const attendees = (data.attendees || []).filter((a: { external_email?: string; team_member_id?: string; profile_id?: string }) => a.external_email || a.team_member_id || a.profile_id)
      // Same batched two-query resolution as POST /api/calendar-events -- was
      // the identical sequential loop, one round-trip per attendee.
      const resolved = await resolveAttendees(attendees as { team_member_id?: string; profile_id?: string; external_name?: string; external_email?: string }[])
      const method = allowed.status === 'cancelled' ? 'CANCEL' : 'REQUEST'
      const ics = buildIcsInvite({
        uid: `${data.id}@oringewaswa`,
        title: data.title, description: data.description, location: data.location,
        startAt: data.start_at, endAt: data.end_at,
        organizer: { name: guard.profile.fullName, email: process.env.EMAIL_USER || 'no-reply@oringewaswa.co.ke' },
        attendees: resolved, method,
      })
      const html = allowed.status === 'cancelled'
        ? `<p style="font-family:Georgia,serif;">The meeting "${data.title}" has been cancelled.</p>`
        : meetingInviteEmail({ title: data.title, description: data.description, location: data.location, meetingLink: data.meeting_link, startAt: data.start_at, endAt: data.end_at, organizerName: guard.profile.fullName })
      await Promise.all(resolved.map((r) => sendEmail({
        to: r.email,
        subject: `${allowed.status === 'cancelled' ? 'Cancelled' : 'Updated'}: ${data.title}`,
        html,
        attachments: [{ filename: 'invite.ics', content: ics, contentType: 'text/calendar; method=' + method }],
      }).catch(() => {})))
    } catch {}
  }

  // Mirror the change onto every calendar this event was copied to. A
  // cancellation removes the copy outright; anything else patches it.
  if (allowed.status === 'cancelled') {
    await syncEventCancelled(params.id)
  } else {
    await syncEventUpdated(params.id)
  }

  await logAudit({ table_name: 'calendar_events', record_id: params.id, action: 'UPDATE', new_data: allowed })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await syncEventCancelled(params.id)

  await logAudit({ table_name: 'calendar_events', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
