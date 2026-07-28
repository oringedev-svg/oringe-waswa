import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

const CATEGORY_LABELS: Record<string, string> = {
  trainee_program: 'Trainee Program',
  qualified_lawyers: 'Qualified Lawyers',
  business_services: 'Business Services',
  support_staff: 'Support Staff',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { job_id, category, full_name, email, phone, message, resume_url } = body

  if (!category || !full_name || !email) {
    return NextResponse.json({ error: 'Name, email, and category are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_id: job_id || null, category, full_name, email, phone, message, resume_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort confirmation, an application should still succeed even if
  // the mailer is misconfigured or momentarily down.
  try {
    await sendEmail({
      to: email,
      subject: 'We received your application',
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #222;">
          <h2 style="color:#14120e;">Thank you, ${full_name}.</h2>
          <p>We've received your application for <strong>${CATEGORY_LABELS[category] || category}</strong> and will be in touch if there's a fit.</p>
          <p style="margin-top:24px;">Oringe Waswa &amp; Akude Advocates LLP</p>
        </div>
      `,
    })
  } catch (e) {
    console.error('Application confirmation email failed:', e)
  }

  return NextResponse.json(data, { status: 201 })
}
