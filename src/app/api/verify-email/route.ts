import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { consumeEmailVerification, type VerifiableTable } from '@/lib/emailVerification'
import { sendEmail, submissionConfirmationEmail, appointmentConfirmationEmail } from '@/lib/email'
import { analyzeSubmission } from '@/lib/openai'
import { format } from 'date-fns'

// A public visitor's submission only actually does anything -- shows up to
// staff, triggers AI triage, sends the "we've got it" email -- once this
// runs. Everything each table needed to happen at creation time was
// deliberately deferred to here (see the three POST routes), so a fake
// email address never costs an AI call, a mailing-list add, or a staff
// member's attention.
async function runPostVerificationEffects(table: VerifiableTable, id: string) {
  const db = createAdminClient()

  if (table === 'submissions') {
    const { data: submission } = await db.from('submissions').select('*').eq('id', id).maybeSingle()
    if (!submission) return

    let aiSummary = ''
    let aiScore = 5
    try {
      const analysis = await analyzeSubmission(submission.type, { submitter_name: submission.submitter_name, submitter_email: submission.submitter_email, ...submission.data })
      aiSummary = analysis.summary
      aiScore = analysis.priority_score
    } catch { /* AI is best-effort everywhere else in this app too */ }

    await db.from('submissions').update({ ai_summary: aiSummary, ai_score: aiScore }).eq('id', id)

    try {
      await db.from('mail_subscribers').upsert(
        { email: submission.submitter_email, name: submission.submitter_name, is_active: true },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    } catch { /* non-critical */ }

    await db.from('submission_updates').insert({
      submission_id: id,
      status: 'pending',
      message: `Your ${submission.type} submission has been received and is pending review. You will hear from us soon.`,
      is_public: true,
      sent_email: true,
    })

    try {
      await sendEmail({
        to: submission.submitter_email,
        subject: `Submission Received, ${submission.tracking_code}`,
        html: submissionConfirmationEmail({
          name: submission.submitter_name,
          type: String(submission.type).charAt(0).toUpperCase() + String(submission.type).slice(1),
          trackingCode: submission.tracking_code,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
        }),
      })
    } catch (e) { console.warn('Submission confirmation email failed:', e) }

    // The public booking flow creates an appointment linked to this exact
    // submission and deliberately skipped sending it a second verification
    // email (see POST /api/appointments) -- confirming the submission is
    // what confirms the booking too.
    if (submission.type === 'appointment') {
      const { data: linkedAppointments } = await db
        .from('appointments')
        .select('id')
        .eq('submission_id', id)
        .is('email_verified_at', null)
      for (const appt of linkedAppointments || []) {
        await db.from('appointments').update({ email_verified_at: new Date().toISOString() }).eq('id', appt.id)
        await runPostVerificationEffects('appointments', appt.id)
      }
    }

    return { trackingCode: submission.tracking_code as string }
  }

  if (table === 'appointments') {
    const { data: appointment } = await db
      .from('appointments')
      .select('*, assigned_attorney:assigned_attorney_id(full_name)')
      .eq('id', id)
      .maybeSingle()
    if (!appointment) return

    if (appointment.status === 'confirmed' && appointment.scheduled_date) {
      try {
        await sendEmail({
          to: appointment.client_email,
          subject: 'Appointment Confirmed, Oringe Waswa & Akude Advocates LLP',
          html: appointmentConfirmationEmail({
            clientName: appointment.client_name,
            date: format(new Date(appointment.scheduled_date), 'EEEE, d MMMM yyyy'),
            time: appointment.scheduled_time || '',
            attorney: appointment.assigned_attorney?.full_name || 'TBD',
            location: appointment.location,
            meetingLink: appointment.meeting_link,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          }),
        })
      } catch (e) { console.warn('Appointment confirmation email failed:', e) }
    }
    return {}
  }

  if (table === 'job_applications') {
    const { data: application } = await db.from('job_applications').select('*').eq('id', id).maybeSingle()
    if (!application) return

    const CATEGORY_LABELS: Record<string, string> = {
      trainee_program: 'Trainee Program', qualified_lawyers: 'Qualified Lawyers',
      business_services: 'Business Services', support_staff: 'Support Staff',
    }
    try {
      await sendEmail({
        to: application.email,
        subject: 'We received your application',
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #222;">
            <h2 style="color:#14120e;">Thank you, ${application.full_name}.</h2>
            <p>We've received your application for <strong>${CATEGORY_LABELS[application.category] || application.category}</strong> and will be in touch if there's a fit.</p>
            <p style="margin-top:24px;">Oringe Waswa &amp; Akude Advocates LLP</p>
          </div>
        `,
      })
    } catch (e) { console.warn('Application confirmation email failed:', e) }
    return {}
  }
}

export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: null }))
  const result = await consumeEmailVerification(token)

  if (!result.ok) {
    const messages = {
      invalid: 'This confirmation link is not valid.',
      expired: 'This confirmation link has expired. Please submit the form again to get a new one.',
      already_used: 'This email has already been confirmed.',
    }
    return NextResponse.json({ ok: false, error: result.error, message: messages[result.error!] }, { status: 400 })
  }

  const extra = await runPostVerificationEffects(result.targetTable!, result.targetId!)
  return NextResponse.json({ ok: true, ...extra })
}
