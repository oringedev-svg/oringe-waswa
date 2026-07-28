import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, getSessionProfile, isAdminRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const trash = searchParams.get('trash') === 'true'

  let query = supabase.from('client_resources').select('*').order('created_at', { ascending: false })
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Public (unauthenticated / non-admin) callers only ever see public resources.
  const profile = await getSessionProfile()
  const isStaff = isAdminRole(profile?.role)
  const visible = isStaff ? data : (data || []).filter((r) => r.access_level === 'public')

  return NextResponse.json(visible)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_resources')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('client_resources').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'client_resources', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_resources')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('client_resources').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'client_resources', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_resources')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('client_resources').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'client_resources', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
