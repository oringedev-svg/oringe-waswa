import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const key of ['title', 'assigned_to', 'due_date']) {
    if (key in body) update[key] = body[key]
  }
  if ('status' in body) {
    if (!['open', 'done'].includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    update.status = body.status
    update.done_at = body.status === 'done' ? new Date().toISOString() : null
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('matter_tasks')
    .update(update)
    .eq('id', params.id)
    .select('id, title, due_date, status, done_at, created_at, assignee:team_members(id, full_name), creator:profiles(full_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'matter_tasks', record_id: params.id, action: 'UPDATE', new_data: update })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('matter_tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'matter_tasks', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
