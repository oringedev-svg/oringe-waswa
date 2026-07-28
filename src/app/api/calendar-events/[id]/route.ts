import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'
import { buildIcsInvite, meetingInviteEmail } from '@/lib/ics'

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
  for (const key of ['title', 'description', 'type', 'start_at', 'end_at', 'location', 'meeting_link', 'status']) {
    if (key in body) allowed[key] = body[key]
  }
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

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
      const resolved: { name: string; email: string }[] = []
      for (const a of attendees) {
        if (a.team_member_id) {
          const { data: m } = await supabase.from('team_members').select('full_name, email').eq('id', a.team_member_id).single()
          if (m?.email) resolved.push({ name: m.full_name, email: m.email })
        } else if (a.profile_id) {
          const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', a.profile_id).single()
          if (p?.email) resolved.push({ name: p.full_name, email: p.email })
        } else if (a.external_email) {
          resolved.push({ name: a.external_name || a.external_email, email: a.external_email })
        }
      }
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

  await logAudit({ table_name: 'calendar_events', record_id: params.id, action: 'UPDATE', new_data: allowed })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'calendar_events', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
