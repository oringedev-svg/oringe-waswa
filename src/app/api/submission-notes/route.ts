import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const submissionId = searchParams.get('submission_id')
  if (!submissionId) return NextResponse.json({ error: 'submission_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('submission_notes')
    .select('id, content, stage, created_at, author:profiles(full_name)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_forms')
  if ('response' in guard) return guard.response

  const { submission_id, content } = await req.json()
  if (!submission_id || !content?.trim()) return NextResponse.json({ error: 'submission_id and content are required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: submission } = await supabase.from('submissions').select('intake_stage').eq('id', submission_id).single()
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('submission_notes')
    .insert({ submission_id, content: content.trim(), stage: submission.intake_stage, author_id: guard.profile.id })
    .select('id, content, stage, created_at, author:profiles(full_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'submission_notes', record_id: data.id, action: 'INSERT', new_data: { submission_id } })
  return NextResponse.json(data, { status: 201 })
}
