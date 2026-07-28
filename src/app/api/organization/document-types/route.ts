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

  let query = supabase
    .from('document_types')
    .select('*, required_for:professional_type_required_documents(is_required, professional_type:professional_types(id, name))')
    .order('sort_order', { ascending: true })
  query = trash ? query.not('archived_at', 'is', null) : query.is('archived_at', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { required_for_professional_type_ids, ...body } = await req.json()
  const { data, error } = await supabase.from('document_types').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(required_for_professional_type_ids) && required_for_professional_type_ids.length > 0) {
    await supabase.from('professional_type_required_documents').insert(
      required_for_professional_type_ids.map((ptId: string) => ({ document_type_id: data.id, professional_type_id: ptId }))
    )
  }

  await logAudit({ table_name: 'document_types', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, required_for_professional_type_ids, ...updates } = await req.json()
  if (restore) updates.archived_at = null

  let data
  if (Object.keys(updates).length > 0) {
    ;({ data } = await supabase.from('document_types').update(updates).eq('id', id).select().single())
  } else {
    ;({ data } = await supabase.from('document_types').select().eq('id', id).single())
  }

  if (Array.isArray(required_for_professional_type_ids)) {
    await supabase.from('professional_type_required_documents').delete().eq('document_type_id', id)
    if (required_for_professional_type_ids.length > 0) {
      await supabase.from('professional_type_required_documents').insert(
        required_for_professional_type_ids.map((ptId: string) => ({ document_type_id: id, professional_type_id: ptId }))
      )
    }
  }

  await logAudit({ table_name: 'document_types', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('document_types').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'document_types', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
