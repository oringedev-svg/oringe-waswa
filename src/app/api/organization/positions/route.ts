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
    .from('positions')
    .select('*, reports_to:positions!positions_reports_to_position_id_fkey(id, name), eligible:position_professional_types(professional_type:professional_types(id, name))')
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
  const { eligible_professional_type_ids, ...body } = await req.json()
  const { data, error } = await supabase.from('positions').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(eligible_professional_type_ids) && eligible_professional_type_ids.length > 0) {
    await supabase.from('position_professional_types').insert(
      eligible_professional_type_ids.map((ptId: string) => ({ position_id: data.id, professional_type_id: ptId }))
    )
  }

  await logAudit({ table_name: 'positions', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}

// PATCH also accepts eligible_professional_type_ids to replace the
// position's eligibility rows in one call, rather than a separate endpoint.
export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, restore, eligible_professional_type_ids, ...updates } = await req.json()
  if (restore) updates.archived_at = null

  let data
  if (Object.keys(updates).length > 0) {
    ;({ data } = await supabase.from('positions').update(updates).eq('id', id).select().single())
  } else {
    ;({ data } = await supabase.from('positions').select().eq('id', id).single())
  }

  if (Array.isArray(eligible_professional_type_ids)) {
    await supabase.from('position_professional_types').delete().eq('position_id', id)
    if (eligible_professional_type_ids.length > 0) {
      await supabase.from('position_professional_types').insert(
        eligible_professional_type_ids.map((ptId: string) => ({ position_id: id, professional_type_id: ptId }))
      )
    }
  }

  await logAudit({ table_name: 'positions', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_organization')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('positions').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'positions', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
