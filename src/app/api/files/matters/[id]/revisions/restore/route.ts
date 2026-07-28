import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { getRevision, saveRevision } from '@/lib/revisions'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json()
  const revisionId = body?.revision_id as string
  if (!revisionId) return NextResponse.json({ error: 'revision_id is required' }, { status: 400 })

  const revision = await getRevision(revisionId)
  if (!revision || revision.table_name !== 'legal_matters' || revision.record_id !== params.id) {
    return NextResponse.json({ error: 'Revision not found for this matter' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const fields = Object.keys(revision.data)
  const selectStr: string = fields.join(', ')
  const { data: current } = await supabase.from('legal_matters').select(selectStr).eq('id', params.id).single()
  if (current) {
    await saveRevision('legal_matters', params.id, current as unknown as Record<string, unknown>, profile.id, 'Auto-saved before restoring an earlier version')
  }

  const { data, error } = await supabase
    .from('legal_matters')
    .update({ ...revision.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'legal_matters', record_id: params.id, action: 'UPDATE', new_data: { restored_from: revisionId } })

  return NextResponse.json(data)
}
