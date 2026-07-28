import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Public GET (no auth): the careers page and nav need to read open vacancies
// without a session. Admin-only fields (trash, unfiltered by is_open) are
// gated behind ?all=true, which requires manage_careers.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const all = searchParams.get('all') === 'true'
  const trash = searchParams.get('trash') === 'true'

  if (all || trash) {
    const guard = await requirePermissionApi('manage_careers')
    if ('response' in guard) return guard.response
  }

  let query = supabase.from('job_openings').select('*').order('created_at', { ascending: false })
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (!all && !trash) query = query.eq('is_open', true)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('job_openings').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'job_openings', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('job_openings').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'job_openings', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('job_openings').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'job_openings', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
