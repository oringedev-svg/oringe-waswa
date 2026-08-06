import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateTrackingCode } from '@/lib/utils'
import { requirePermissionApi } from '@/lib/auth'
import { createEmailVerification } from '@/lib/emailVerification'

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
  // An unconfirmed submission is exactly the untraceable-inquiry problem
  // this exists to prevent, so it never appears in the admin queue, no
  // matter what filters are applied.
  query = query.not('email_verified_at', 'is', null)
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

    // The intake pipeline (Client Request -> Conflict Check -> ...) only
    // applies to enquiries that could become a matter. Other submission
    // types (job applications, volunteering, papers) leave this null.
    const intake_stage = ['contact', 'appointment'].includes(type) ? 'received' : null
    // AI analysis, the mailing-list add, and the "we've got it" email all
    // moved to /api/verify-email -- see runPostVerificationEffects there.
    // None of them should happen (or cost an AI call) for an email address
    // nobody has actually confirmed owning yet.
    const basePayload = {
      tracking_code: trackingCode,
      type,
      status: 'pending',
      submitter_name,
      submitter_email,
      submitter_phone,
      data: data || {},
      email_verified_at: null,
    }

    // This is the public contact form, it must never fail because of a
    // migration that hasn't been run yet. Try with intake_stage; if that
    // column doesn't exist, fall back to the insert that always worked.
    let { data: submission, error } = await supabase.from('submissions').insert({ ...basePayload, intake_stage }).select().single()
    if (error?.message?.includes('intake_stage')) {
      ({ data: submission, error } = await supabase.from('submissions').insert(basePayload).select().single())
    }
    if (error?.message?.includes('email_verified_at')) {
      // Migration 060 hasn't run yet on this database -- fall back rather
      // than breaking the public form, but this submission will only ever
      // be reachable by ID until it has, since the admin list filters on
      // that column.
      const { intake_stage: _is, email_verified_at: _ev, ...legacyPayload } = { ...basePayload, intake_stage }
      void _is; void _ev
      ;({ data: submission, error } = await supabase.from('submissions').insert(legacyPayload).select().single())
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      await createEmailVerification(supabase, {
        email: submitter_email,
        name: submitter_name,
        targetTable: 'submissions',
        targetId: submission.id,
        context: `your ${type} submission (${trackingCode})`,
      })
    } catch (e) {
      console.error('Could not send verification email:', e)
    }

    return NextResponse.json({
      submission,
      trackingCode,
      pendingVerification: true,
      message: 'Check your email and confirm the link we sent to complete your submission.',
    }, { status: 201 })
  } catch (error) {
    console.error('Submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
