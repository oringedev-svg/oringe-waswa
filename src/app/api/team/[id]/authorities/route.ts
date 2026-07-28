import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_authorities')
    .select('*, authority:legal_authorities(id, name)')
    .eq('team_member_id', params.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const body = await req.json()
  if (!body.authority_id) return NextResponse.json({ error: 'authority_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_authorities')
    .insert({
      team_member_id: params.id,
      authority_id: body.authority_id,
      issuing_body: body.issuing_body || null,
      reference_number: body.reference_number || null,
      issue_date: body.issue_date || null,
      expiry_date: body.expiry_date || null,
      status: body.status || 'active',
      certificate_url: body.certificate_url || null,
    })
    .select('*, authority:legal_authorities(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_member_authorities', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_authorities')
    .update(updates)
    .eq('id', id)
    .select('*, authority:legal_authorities(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_member_authorities', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const recordId = searchParams.get('record_id')
  const { error } = await supabase.from('team_member_authorities').delete().eq('id', recordId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_member_authorities', record_id: recordId, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
