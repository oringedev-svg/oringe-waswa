import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requireAdminApi } from '@/lib/auth'
import { createEmailVerification } from '@/lib/emailVerification'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const attorney_id = searchParams.get('attorney_id')
  const date = searchParams.get('date')
  const trash = searchParams.get('trash') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabase
    .from('appointments')
    .select('*, assigned_attorney:assigned_attorney_id(full_name, position, avatar_url)', { count: 'exact' })
    .order('scheduled_date', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)

  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  // Same rule as submissions: nobody has confirmed this address owns this
  // booking yet, so it doesn't show up for staff.
  query = query.not('email_verified_at', 'is', null)
  if (status) query = query.eq('status', status)
  if (attorney_id) query = query.eq('assigned_attorney_id', attorney_id)
  if (date) query = query.eq('scheduled_date', date)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  if (!body.client_name || !body.client_email) {
    return NextResponse.json({ error: 'client_name and client_email are required' }, { status: 400 })
  }

  // The confirmation email (sent only once email_verified_at is set, in
  // /api/verify-email) is what actually notifies the client their booking
  // went through, so this insert never needs to send one itself.
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({ ...body, email_verified_at: null })
    .select('*, assigned_attorney:assigned_attorney_id(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'appointments', record_id: appointment.id, action: 'INSERT', new_data: body })

  // The public booking flow always creates a `submissions` row (type
  // 'appointment') first and passes its id here, so that submission is
  // already sending its own verification email to this exact address.
  // A second, separate one for the appointment row would just be a
  // duplicate email asking to confirm the same booking twice -- instead,
  // verifying the submission cascades to this row too, see the
  // 'submissions' branch of runPostVerificationEffects in
  // /api/verify-email. Only a standalone appointment (no submission_id)
  // needs its own verification.
  if (!appointment.submission_id) {
    try {
      await createEmailVerification(supabase, {
        email: appointment.client_email,
        name: appointment.client_name,
        targetTable: 'appointments',
        targetId: appointment.id,
        context: 'booking a consultation with us',
      })
    } catch (e) {
      console.error('Could not send verification email:', e)
    }
  }

  return NextResponse.json({ ...appointment, pendingVerification: true, message: 'Check your email and confirm the link we sent to secure this booking.' }, { status: 201 })
}
