import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Same shape as /api/submission-notes: a standalone internal note, not
// paired with a stage change (that path lives on the PATCH handler above
// it, so a note left mid-review doesn't force a stage transition).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: application } = await supabase.from('job_applications').select('id').eq('id', params.id).single()
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('job_application_notes')
    .insert({ application_id: params.id, content: content.trim(), author_id: guard.profile.id })
    .select('id, content, created_at, author:profiles(full_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('job_application_events').insert({ application_id: params.id, type: 'note_added', actor_id: guard.profile.id })
  await logAudit({ table_name: 'job_application_notes', record_id: data.id, action: 'INSERT', new_data: { application_id: params.id } })
  return NextResponse.json(data, { status: 201 })
}
