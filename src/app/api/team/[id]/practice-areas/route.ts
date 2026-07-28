import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_practice_areas')
    .select('practice_area:practice_areas(id, title)')
    .eq('team_member_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map((r) => r.practice_area))
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const { ids } = await req.json()
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })

  const supabase = createAdminClient()
  await supabase.from('team_member_practice_areas').delete().eq('team_member_id', params.id)
  if (ids.length > 0) {
    const { error } = await supabase.from('team_member_practice_areas').insert(ids.map((practiceAreaId: string) => ({ team_member_id: params.id, practice_area_id: practiceAreaId })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await logAudit({ table_name: 'team_member_practice_areas', record_id: params.id, action: 'UPDATE', new_data: { ids } })
  return NextResponse.json({ success: true })
}
