import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

async function canAccess(profileId: string, assignmentId: string) {
  const supabase = createAdminClient()
  const { data: assignment } = await supabase.from('assignments').select('assigned_by, assigned_to').eq('id', assignmentId).single()
  if (!assignment) return { supabase, assignment: null, teamMemberId: null }
  const { data: team } = await supabase.from('team_members').select('id').eq('profile_id', profileId).maybeSingle()
  return { supabase, assignment, teamMemberId: team?.id || null }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile(); if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { supabase, assignment, teamMemberId } = await canAccess(profile.id, params.id)
  if (!assignment || (assignment.assigned_by !== profile.id && assignment.assigned_to !== teamMemberId && profile.role !== 'admin')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  const { data, error } = await supabase.from('tasks').select('*').eq('assignment_id', params.id).order('sequence')
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ tasks: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile(); if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { supabase, assignment } = await canAccess(profile.id, params.id)
  if (!assignment || assignment.assigned_by !== profile.id) return NextResponse.json({ error: 'Only the assigner can create tasks' }, { status: 403 })
  const body = await req.json()
  if (!body.title || !Number.isInteger(body.sequence)) return NextResponse.json({ error: 'title and integer sequence are required' }, { status: 422 })
  const { data, error } = await supabase.from('tasks').insert({ assignment_id: params.id, title: body.title, sequence: body.sequence, assignee_id: body.assignee_id || null, depends_on_task_id: body.depends_on_task_id || null, estimated_hours: body.estimated_hours || null }).select().single()
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile(); if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { supabase, assignment, teamMemberId } = await canAccess(profile.id, params.id)
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const { task_id, action, actual_hours } = await req.json()
  const { data: task } = await supabase.from('tasks').select('*').eq('id', task_id).eq('assignment_id', params.id).single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.assignee_id && task.assignee_id !== teamMemberId && assignment.assigned_by !== profile.id) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  if (action === 'start') {
    if (task.status !== 'PENDING') return NextResponse.json({ error: 'Task must be pending' }, { status: 409 })
    if (task.depends_on_task_id) { const { data: predecessor } = await supabase.from('tasks').select('status').eq('id', task.depends_on_task_id).single(); if (predecessor?.status !== 'DONE') return NextResponse.json({ error: 'dependency_unmet' }, { status: 422 }) }
    const { data, error } = await supabase.from('tasks').update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() }).eq('id', task.id).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data)
  }
  if (action === 'complete' && task.status === 'IN_PROGRESS') { const { data, error } = await supabase.from('tasks').update({ status: 'DONE', actual_hours: actual_hours ?? task.actual_hours, updated_at: new Date().toISOString() }).eq('id', task.id).select().single(); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data) }
  return NextResponse.json({ error: 'Invalid task action' }, { status: 400 })
}
