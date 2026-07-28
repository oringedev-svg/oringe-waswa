import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const category = searchParams.get('category')
  const trash = searchParams.get('trash') === 'true'

  let query = supabase
    .from('problem_types')
    .select('*, solutions:problem_solutions(*)')
    .order('display_order', { ascending: true })
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Solutions are fetched as a nested resource; sort them by priority so
  // the UI never has to re-sort, the whole point of "priority" is that
  // the ordering is meaningful.
  const sorted = (data || []).map((p) => ({
    ...p,
    solutions: (p.solutions || []).slice().sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority),
  }))
  return NextResponse.json(sorted)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('problem_types').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_types', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('problem_types').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_types', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_legal_knowledge')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('problem_types').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'problem_types', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
