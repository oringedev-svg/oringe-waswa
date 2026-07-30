import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendEmail } from '@/lib/email'

const CATEGORY_LABELS: Record<string, string> = {
  trainee_program: 'Trainee Program',
  qualified_lawyers: 'Qualified Lawyers',
  business_services: 'Business Services',
  support_staff: 'Support Staff',
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  offer_extended: 'Offer Extended',
  hired: 'Hired',
  rejected: 'Declined',
}

// Every stage the applicant should hear about. 'reviewing' is deliberately
// silent, an application going "under review" the moment it lands is not
// news to anyone, acef's own version emailed on that transition too and it
// reads as noise.
function applicantEmailFor(stage: string, jobTitle: string, reason?: string) {
  const subjects: Record<string, string> = {
    shortlisted: `You've been shortlisted, ${jobTitle}`,
    interview_scheduled: `Interview scheduled, ${jobTitle}`,
    offer_extended: `An offer for you, ${jobTitle}`,
    hired: `Welcome to the firm, ${jobTitle}`,
    rejected: `Update on your application, ${jobTitle}`,
  }
  const bodies: Record<string, string> = {
    shortlisted: `Thank you for applying for the ${jobTitle} position. Your application has been shortlisted, and we will be in touch about next steps shortly.`,
    interview_scheduled: `Your interview for the ${jobTitle} position has been scheduled. You will receive the details in a separate calendar invitation.`,
    offer_extended: `We are pleased to extend an offer for the ${jobTitle} position. Our team will be in touch shortly with the formal offer and next steps.`,
    hired: `Welcome to Oringe Waswa & Akude Advocates LLP. We are delighted to confirm your appointment to the ${jobTitle} position, and look forward to your first day.`,
    rejected: `Thank you for applying for the ${jobTitle} position. After careful consideration, we will not be moving forward with your application at this time.${reason ? ` ${reason}` : ''}`,
  }
  return subjects[stage] ? { subject: subjects[stage], body: bodies[stage] } : null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const [appRes, notesRes, eventsRes, interviewsRes] = await Promise.all([
    supabase
      .from('job_applications')
      .select(`
        *,
        job_openings(id, title, category, location),
        assignee:assigned_to(id, full_name, position),
        reviewer:reviewed_by(full_name)
      `)
      .eq('id', params.id)
      .single(),
    supabase
      .from('job_application_notes')
      .select('id, content, created_at, author:profiles(full_name)')
      .eq('application_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('job_application_events')
      .select('id, type, detail, created_at, actor:profiles(full_name)')
      .eq('application_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, location, meeting_link, status')
      .eq('job_application_id', params.id)
      .order('start_at', { ascending: false }),
  ])

  if (appRes.error || !appRes.data) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  return NextResponse.json({
    ...appRes.data,
    notes: notesRes.data || [],
    events: eventsRes.data || [],
    interviews: interviewsRes.data || [],
  })
}

// Every write to an application goes through here: stage transitions,
// reassignment, and the hire-and-onboard action, so the event timeline
// only has one place it can be written from and never drifts out of sync
// with what actually changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const supabase = createAdminClient()

  const { data: application, error: fetchError } = await supabase
    .from('job_applications')
    .select('*, job_openings(title)')
    .eq('id', params.id)
    .single()
  if (fetchError || !application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const jobTitle = application.job_openings?.title || CATEGORY_LABELS[application.category] || 'the role'

  // --- Reassignment only, no stage change ---
  if ('assigned_to' in body && !('status' in body)) {
    const { error } = await supabase.from('job_applications').update({ assigned_to: body.assigned_to || null }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // --- Link a just-issued certificate back to the application it was
  // issued for, so "Issue Certificate" only ever offers to do it once. ---
  if ('certificate_id' in body) {
    if (!application.onboarded_profile_id) {
      return NextResponse.json({ error: 'Onboard this applicant before issuing a certificate' }, { status: 400 })
    }
    const { error } = await supabase.from('job_applications').update({ certificate_id: body.certificate_id }).eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('job_application_events').insert({ application_id: params.id, type: 'certified', actor_id: guard.profile.id })
    return NextResponse.json({ ok: true })
  }

  // --- Stage transition ---
  if ('status' in body) {
    const { status, notify_applicant, note } = body

    if (status === 'rejected' && !body.rejection_reason?.trim()) {
      return NextResponse.json({ error: 'A reason is required to decline an application' }, { status: 400 })
    }
    if (status === application.status) {
      return NextResponse.json({ error: `Already ${STAGE_LABELS[status] || status}` }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      status,
      reviewed_by: guard.profile.id,
      reviewed_at: new Date().toISOString(),
    }
    if (status === 'rejected') updates.rejection_reason = body.rejection_reason.trim()

    const { data: updated, error: updateError } = await supabase
      .from('job_applications')
      .update(updates)
      .eq('id', params.id)
      .select('*, job_openings(title)')
      .single()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    await supabase.from('job_application_events').insert({
      application_id: params.id,
      type: 'status_changed',
      detail: `${STAGE_LABELS[application.status] || application.status} -> ${STAGE_LABELS[status] || status}`,
      actor_id: guard.profile.id,
    })
    if (note?.trim()) {
      await supabase.from('job_application_notes').insert({ application_id: params.id, content: note.trim(), author_id: guard.profile.id })
      await supabase.from('job_application_events').insert({ application_id: params.id, type: 'note_added', actor_id: guard.profile.id })
    }

    // Best-effort: an applicant not hearing about a stage change is a
    // worse outcome than a mail failure blocking the stage change itself.
    if (notify_applicant) {
      const email = applicantEmailFor(status, jobTitle, status === 'rejected' ? body.rejection_reason : undefined)
      if (email) {
        try {
          await sendEmail({
            to: updated.email,
            subject: email.subject,
            html: `<div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #222;">
              <p>Dear ${updated.full_name},</p>
              <p>${email.body}</p>
              <p style="margin-top:24px;">Oringe Waswa &amp; Akude Advocates LLP</p>
            </div>`,
          })
        } catch (e) {
          console.error('Applicant stage-change email failed:', e)
        }
      }
    }

    await logAudit({ table_name: 'job_applications', record_id: params.id, action: 'UPDATE', new_data: { status } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
