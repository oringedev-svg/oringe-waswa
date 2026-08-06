import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createEmailVerification } from '@/lib/emailVerification'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { job_id, category, full_name, email, phone, message, resume_url, resume_file_url, resume_file_name } = body

  if (!category || !full_name || !email) {
    return NextResponse.json({ error: 'Name, email, and category are required.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // The "we received it" email moved to /api/verify-email -- an applicant
  // who never confirms this address doesn't reach the recruiter's queue at
  // all (see the email_verified_at filter on GET /api/careers/applications).
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_id: job_id || null, category, full_name, email, phone, message, resume_url, resume_file_url, resume_file_name, email_verified_at: null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await createEmailVerification(supabase, {
      email,
      name: full_name,
      targetTable: 'job_applications',
      targetId: data.id,
      context: 'your application to Oringe Waswa & Akude Advocates LLP',
    })
  } catch (e) {
    console.error('Could not send verification email:', e)
  }

  return NextResponse.json({ ...data, pendingVerification: true, message: 'Check your email and confirm the link we sent to complete your application.' }, { status: 201 })
}
