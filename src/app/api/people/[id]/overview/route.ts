import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

// One call answers "who is this person and where do we stand with them":
// profile + portal status, their submissions, their matters, and their
// invoices, the client hub loads from this single endpoint.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, user_id, is_active, created_at')
    .eq('id', params.id)
    .single()
  if (error || !profile) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

  const { data: links } = await supabase
    .from('matter_people')
    .select('matter_id, role')
    .eq('profile_id', profile.id)
  const matterIds = (links || []).map((l) => l.matter_id)

  const [{ data: matters }, { data: invoices }, { data: submissions }, { data: appointments }] = await Promise.all([
    matterIds.length > 0
      ? supabase
          .from('legal_matters')
          .select('id, matter_number, title, type, status, opening_date')
          .in('id', matterIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    matterIds.length > 0
      ? supabase
          .from('invoices')
          .select('id, matter_id, invoice_number, status, total, due_date, issued_at')
          .in('matter_id', matterIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from('submissions')
      .select('id, type, status, tracking_code, created_at')
      .eq('submitter_email', profile.email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    // Appointments belong to the account too, matched by the client's email.
    supabase
      .from('appointments')
      .select('id, matter_type, description, status, scheduled_date, scheduled_time, assigned_attorney:assigned_attorney_id(full_name), created_at')
      .eq('client_email', profile.email)
      .order('scheduled_date', { ascending: false, nullsFirst: false }),
  ])

  return NextResponse.json({
    profile,
    matters: matters || [],
    invoices: invoices || [],
    submissions: submissions || [],
    appointments: appointments || [],
  })
}
