import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  if (!body.problem_id || !body.solution) {
    return NextResponse.json({ error: 'problem_id and solution are required' }, { status: 400 })
  }
  const { data, error } = await supabase.from('problem_solutions').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_solutions', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, ...updates } = await req.json()
  const { data, error } = await supabase.from('problem_solutions').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_solutions', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('problem_solutions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_solutions', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
