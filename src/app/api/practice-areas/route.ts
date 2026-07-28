import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const trash = searchParams.get('trash') === 'true'
  const groupSlug = searchParams.get('group')

  // The group embed is best-effort: on a deployment where migration 024
  // (practice_area_groups, the group_id column) hasn't run yet, the
  // embedded select fails and this falls back to the plain list rather
  // than breaking the page.
  let query = supabase.from('practice_areas').select('*, group:practice_area_groups(id, name, slug)').order('display_order', { ascending: true })
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)

  let { data, error } = await query
  if (error) {
    let fallback = supabase.from('practice_areas').select('*').order('display_order', { ascending: true })
    fallback = trash ? fallback.not('deleted_at', 'is', null) : fallback.is('deleted_at', null)
    ;({ data, error } = await fallback)
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = groupSlug && data
    ? data.filter((a) => (a as { group?: { slug?: string } }).group?.slug === groupSlug)
    : data

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_practice_areas')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('practice_areas').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'practice_areas', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_practice_areas')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('practice_areas').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'practice_areas', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_practice_areas')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('practice_areas').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'practice_areas', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
