import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const trash = searchParams.get('trash') === 'true'
  const categoryId = searchParams.get('org_category_id')

  let query = supabase
    .from('professional_types')
    .select('*, category:org_categories(id, name)')
    .order('sort_order', { ascending: true })
  query = trash ? query.not('archived_at', 'is', null) : query.is('archived_at', null)
  if (categoryId) query = query.eq('org_category_id', categoryId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('professional_types').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'professional_types', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.archived_at = null
  const { data, error } = await supabase.from('professional_types').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'professional_types', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('professional_types').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'professional_types', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
