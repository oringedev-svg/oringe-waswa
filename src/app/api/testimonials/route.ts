import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const trash = searchParams.get('trash') === 'true'
  // 'client' (homepage praise) or 'staff' (Working at Oringe voices). Absent
  // means client, so the homepage never picks up staff quotes by accident.
  const kind = searchParams.get('kind')

  let query = supabase.from('testimonials').select('*').order('display_order', { ascending: true })
  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)

  const { data, error } = await query

  // The kind column arrives with migration 025. Until it is run, filtering on
  // it errors, so fall back to the unfiltered list and treat everything as
  // client praise (which is what it was before staff voices existed).
  if (!error && kind) {
    const filtered = (data ?? []).filter(t => ((t as { kind?: string }).kind ?? 'client') === kind)
    return NextResponse.json(filtered)
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_testimonials')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('testimonials').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'testimonials', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_testimonials')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('testimonials').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'testimonials', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_testimonials')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('testimonials').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'testimonials', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
