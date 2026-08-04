import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, appointmentConfirmationEmail } from '@/lib/email'
import { format } from 'date-fns'
import { logAudit } from '@/lib/audit'
import { requireAdminApi } from '@/lib/auth'

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

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert(body)
    .select('*, assigned_attorney:assigned_attorney_id(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'appointments', record_id: appointment.id, action: 'INSERT', new_data: body })

  // Send confirmation if status is confirmed
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
    } catch (e) { console.warn('Email error:', e) }
  }

  return NextResponse.json(appointment, { status: 201 })
}
