import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  const submissionId = searchParams.get('submission_id')
  if (!matterId && !submissionId) return NextResponse.json({ error: 'matter_id or submission_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  let query = supabase
    .from('matter_tasks')
    .select('id, title, due_date, status, done_at, created_at, assignee:team_members(id, full_name), creator:profiles(full_name)')
    .order('status', { ascending: false }) // open before done
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  query = matterId ? query.eq('matter_id', matterId) : query.eq('submission_id', submissionId!)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const { matter_id, submission_id, title, assigned_to, due_date } = await req.json()
  if ((!matter_id && !submission_id) || !title?.trim()) {
    return NextResponse.json({ error: 'title and either matter_id or submission_id are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // Only include submission_id when it's actually used, forcing the key
  // into every insert broke matter-only task creation (the feature that
  // already worked) on any database that hasn't run migration 015 yet,
  // since that's the migration that adds the column at all.
  const insertPayload: Record<string, unknown> = {
    title: title.trim(),
    assigned_to: assigned_to || null,
    due_date: due_date || null,
    created_by: guard.profile.id,
  }
  if (matter_id) insertPayload.matter_id = matter_id
  if (submission_id) insertPayload.submission_id = submission_id

  const { data, error } = await supabase
    .from('matter_tasks')
    .insert(insertPayload)
    .select('id, title, due_date, status, done_at, created_at, assignee:team_members(id, full_name), creator:profiles(full_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'matter_tasks', record_id: data.id, action: 'INSERT', new_data: { matter_id, submission_id, title, assigned_to } })
  return NextResponse.json(data, { status: 201 })
}
