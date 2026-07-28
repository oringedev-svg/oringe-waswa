import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requirePermissionApi } from '@/lib/auth'
import { saveRevision, getRevisions } from '@/lib/revisions'

const REVISIONED_FIELDS = ['full_name', 'position', 'department', 'specializations', 'bio', 'education'] as const

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('team_members').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const revisions = await getRevisions('team_members', params.id)
  return NextResponse.json({ ...data, revisions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  const { data: current } = await supabase
    .from('team_members')
    .select('full_name, position, department, specializations, bio, education')
    .eq('id', params.id)
    .single()

  const changed = current && REVISIONED_FIELDS.some((f) => f in body && JSON.stringify(body[f]) !== JSON.stringify((current as Record<string, unknown>)[f]))
  if (changed) {
    await saveRevision('team_members', params.id, current as unknown as Record<string, unknown>, guard.profile.id)
  }

  const { data, error } = await supabase.from('team_members').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_members', record_id: params.id, action: 'UPDATE', new_data: body })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_members', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
