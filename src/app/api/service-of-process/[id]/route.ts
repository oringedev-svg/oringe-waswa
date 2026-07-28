import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const { status, response_note } = body
  if (!['responded', 'escalated'].includes(status)) {
    return NextResponse.json({ error: 'status must be responded or escalated' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const updates: Record<string, unknown> = { status, response_note: response_note || null }
  if (status === 'responded') updates.responded_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('service_of_process')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The diarised task has served its purpose once the outcome is known,
  // best-effort so this never blocks the record update itself.
  if (data.task_id) {
    try {
      await supabase.from('matter_tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', data.task_id)
    } catch {}
  }

  await logAudit({ table_name: 'service_of_process', record_id: params.id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}
