import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { getRevision, saveRevision } from '@/lib/revisions'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const revisionId = body?.revision_id as string
  if (!revisionId) return NextResponse.json({ error: 'revision_id is required' }, { status: 400 })

  const revision = await getRevision(revisionId)
  if (!revision || revision.table_name !== 'team_members' || revision.record_id !== params.id) {
    return NextResponse.json({ error: 'Revision not found for this team member' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const fields = Object.keys(revision.data)
  const selectStr: string = fields.join(', ')
  const { data: current } = await supabase.from('team_members').select(selectStr).eq('id', params.id).single()
  if (current) {
    await saveRevision('team_members', params.id, current as unknown as Record<string, unknown>, guard.profile.id, 'Auto-saved before restoring an earlier version')
  }

  const { data, error } = await supabase
    .from('team_members')
    .update({ ...revision.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'team_members', record_id: params.id, action: 'UPDATE', new_data: { restored_from: revisionId } })

  return NextResponse.json(data)
}
