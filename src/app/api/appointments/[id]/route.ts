import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, appointmentConfirmationEmail } from '@/lib/email'
import { format } from 'date-fns'
import { logAudit } from '@/lib/audit'
import { requireAdminApi } from '@/lib/auth'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('*, assigned_attorney:team_members(full_name, position)')
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
  const { restore, ...rest } = body
  const updates: Record<string, unknown> = { ...rest }
  if (restore) updates.deleted_at = null

  const { data: appt, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .select('*, assigned_attorney:team_members(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'appointments', record_id: params.id, action: 'UPDATE', new_data: body })

  // Send email on confirmation
  if (body.status === 'confirmed' && appt.scheduled_date) {
    try {
      await sendEmail({
        to: appt.client_email,
        subject: 'Appointment Confirmed, Oringe Waswa & Akude Advocates LLP',
        html: appointmentConfirmationEmail({
          clientName: appt.client_name,
          date: format(new Date(appt.scheduled_date), 'EEEE, d MMMM yyyy'),
          time: appt.scheduled_time || '',
          attorney: appt.assigned_attorney?.full_name || 'TBD',
          location: appt.location,
          meetingLink: appt.meeting_link,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
        }),
      })
    } catch (e) { console.warn('Email error:', e) }
  }

  return NextResponse.json(appt)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('appointments').update({ deleted_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'appointments', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
