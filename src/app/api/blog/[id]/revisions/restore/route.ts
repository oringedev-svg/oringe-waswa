import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { getRevision, saveRevision } from '@/lib/revisions'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const body = await req.json()
  const revisionId = body?.revision_id as string
  if (!revisionId) return NextResponse.json({ error: 'revision_id is required' }, { status: 400 })

  const revision = await getRevision(revisionId)
  if (!revision || revision.table_name !== 'blog_posts' || revision.record_id !== params.id) {
    return NextResponse.json({ error: 'Revision not found for this post' }, { status: 404 })
  }

  const supabase = createAdminClient()

  // Snapshot the current state first, so restoring is itself undoable.
  const fields = Object.keys(revision.data)
  const selectStr: string = fields.join(', ')
  const { data: current } = await supabase.from('blog_posts').select(selectStr).eq('id', params.id).single()
  if (current) {
    await saveRevision('blog_posts', params.id, current as unknown as Record<string, unknown>, guard.profile.id, 'Auto-saved before restoring an earlier version')
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .update({ ...revision.data, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'blog_posts', record_id: params.id, action: 'UPDATE', new_data: { restored_from: revisionId } })

  return NextResponse.json(data)
}
