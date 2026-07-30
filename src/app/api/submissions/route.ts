import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, submissionConfirmationEmail } from '@/lib/email'
import { analyzeSubmission } from '@/lib/openai'
import { generateTrackingCode } from '@/lib/utils'
import { requirePermissionApi } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('triage_intake')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const trash = searchParams.get('trash') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabase
    .from('submissions')
    .select('*, assigned_member:team_members(full_name, position)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`submitter_name.ilike.%${search}%,submitter_email.ilike.%${search}%,tracking_code.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, limit })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json()
    const { type, submitter_name, submitter_email, submitter_phone, data } = body

    if (!type || !submitter_name || !submitter_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const trackingCode = generateTrackingCode(type)

    // AI analysis (non-blocking)
    let aiSummary = ''
    let aiScore = 5
    try {
      const analysis = await analyzeSubmission(type, { submitter_name, submitter_email, ...data })
      aiSummary = analysis.summary
      aiScore = analysis.priority_score
    } catch {}

    // The intake pipeline (Client Request -> Conflict Check -> ...) only
    // applies to enquiries that could become a matter. Other submission
    // types (job applications, volunteering, papers) leave this null.
    const intake_stage = ['contact', 'appointment'].includes(type) ? 'received' : null
    const basePayload = {
      tracking_code: trackingCode,
      type,
      status: 'pending',
      submitter_name,
      submitter_email,
      submitter_phone,
      data: data || {},
      ai_summary: aiSummary,
      ai_score: aiScore,
    }

    // This is the public contact form, it must never fail because of a
    // migration that hasn't been run yet. Try with intake_stage; if that
    // column doesn't exist, fall back to the insert that always worked.
    let { data: submission, error } = await supabase.from('submissions').insert({ ...basePayload, intake_stage }).select().single()
    if (error?.message?.includes('intake_stage')) {
      ({ data: submission, error } = await supabase.from('submissions').insert(basePayload).select().single())
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-subscribe to mailing list
    try {
      await supabase.from('mail_subscribers').upsert(
        { email: submitter_email, name: submitter_name, is_active: true },
        { onConflict: 'email', ignoreDuplicates: true }
      )
    } catch {}

    // Send confirmation email
    try {
      await sendEmail({
        to: submitter_email,
        subject: `Submission Received, ${trackingCode}`,
        html: submissionConfirmationEmail({
          name: submitter_name,
          type: type.charAt(0).toUpperCase() + type.slice(1),
          trackingCode,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
        }),
      })
    } catch (emailError) {
      console.warn('Email send failed:', emailError)
    }

    // Initial status update
    await supabase.from('submission_updates').insert({
      submission_id: submission.id,
      status: 'pending',
      message: `Your ${type} submission has been received and is pending review. You will hear from us soon.`,
      is_public: true,
      sent_email: true,
    })

    return NextResponse.json({ submission, trackingCode }, { status: 201 })
  } catch (error) {
    console.error('Submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
