import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { responseDueDate, locationTierMeta } from '@/lib/serviceOfProcess'
import { formatDate } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  if (!matterId) return NextResponse.json({ error: 'matter_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('service_of_process')
    .select('*, document:legal_documents(id, title), task:matter_tasks(id, status)')
    .eq('matter_id', matterId)
    .order('served_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const { matter_id, recipient_name, location_tier, served_at } = body
  if (!matter_id || !recipient_name?.trim() || !location_tier || !served_at) {
    return NextResponse.json({ error: 'matter_id, recipient_name, location_tier, and served_at are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const dueDate = responseDueDate(served_at, location_tier)

  const { data, error } = await supabase
    .from('service_of_process')
    .insert({
      matter_id,
      document_id: body.document_id || null,
      document_description: body.document_description || null,
      recipient_name: recipient_name.trim(),
      recipient_role: body.recipient_role || null,
      location_tier,
      method: body.method || null,
      served_at,
      response_due_date: dueDate,
      created_by: guard.profile.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The "diarise" step: a real matter task due on the response deadline, so
  // it shows up in the firm's normal Calendar/My Desk surfaces, not just as
  // a badge on this record. Best-effort, logging this task must never
  // block the service record itself from being saved.
  try {
    const { data: task } = await supabase
      .from('matter_tasks')
      .insert({
        matter_id,
        title: `Check for response, service on ${recipient_name.trim()} (${locationTierMeta(location_tier).label}, due ${formatDate(dueDate, 'short')})`,
        due_date: dueDate,
        created_by: guard.profile.id,
      })
      .select('id')
      .single()
    if (task) await supabase.from('service_of_process').update({ task_id: task.id }).eq('id', data.id)
  } catch {}

  await logAudit({ table_name: 'service_of_process', record_id: data.id, action: 'INSERT', new_data: { matter_id, recipient_name, location_tier, served_at, response_due_date: dueDate } })
  return NextResponse.json(data, { status: 201 })
}
