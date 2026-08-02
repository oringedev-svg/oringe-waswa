import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { runMultiConflictSearch, type ConflictTarget } from '@/lib/conflictSearch'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  const submissionId = searchParams.get('submission_id')
  if (!matterId && !submissionId) return NextResponse.json({ error: 'matter_id or submission_id is required' }, { status: 400 })

  let query = supabase
    .from('conflict_checks')
    .select('*, checker:profiles!conflict_checks_checked_by_fkey(full_name), decider:profiles!conflict_checks_decided_by_fkey(full_name)')
    .order('created_at', { ascending: false })
  query = matterId ? query.eq('matter_id', matterId) : query.eq('submission_id', submissionId!)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('run_conflict_check')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const matterId = body.matter_id as string | undefined
  const submissionId = body.submission_id as string | undefined
  // A check now covers every party at once (client, opposing party, directors,
  // and so on). The single `query` form is still accepted so older callers and
  // saved links keep working; it's just a one-target search.
  const rawTargets = Array.isArray(body.targets) ? (body.targets as ConflictTarget[]) : null
  const query = (body.query as string || '').trim()
  const targets: ConflictTarget[] = rawTargets?.length
    ? rawTargets.filter(t => typeof t?.name === 'string' && t.name.trim().length > 0)
    : query
      ? [{ name: query, role: 'client' }]
      : []

  if ((!matterId && !submissionId) || targets.length === 0) {
    return NextResponse.json(
      { error: 'At least one search target, and either matter_id or submission_id, are required' },
      { status: 400 },
    )
  }

  // Running a check pre-matter (from a submission) or on a matter is the
  // same search over the same firm-wide records, just entered from a
  // different point in one continuous pipeline.
  let matter: { id: string; status: string } | null = null
  let submission: { id: string; intake_stage: string | null; submitter_name: string } | null = null
  if (matterId) {
    const { data } = await supabase.from('legal_matters').select('id, status').eq('id', matterId).single()
    if (!data) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    matter = data
  } else {
    const { data } = await supabase.from('submissions').select('id, intake_stage, submitter_name').eq('id', submissionId).single()
    if (!data) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    submission = data
  }

  const { results, highestRisk, summary } = await runMultiConflictSearch(targets, {
    excludeMatterId: matterId,
    excludeSubmissionId: submissionId,
  })

  const { data, error } = await supabase
    .from('conflict_checks')
    .insert({
      matter_id: matterId || null,
      submission_id: submissionId || null,
      search_query: summary,
      results,
      highest_risk: highestRisk,
      checked_by: guard.profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'conflict_checks', record_id: data.id, action: 'INSERT', new_data: { matter_id: matterId, submission_id: submissionId, targets, search_query: summary, highest_risk: highestRisk } })

  // Running a check IS entering the conflict-check step, the pipeline
  // should reflect what actually happened, not wait for a second manual
  // click. Gated by the same run_conflict_check permission either way.
  if (matter && matter.status === 'lead') {
    await supabase.from('legal_matters').update({ status: 'conflict_check', updated_at: new Date().toISOString() }).eq('id', matter.id)
    await logAudit({ table_name: 'legal_matters', record_id: matter.id, action: 'UPDATE', new_data: { status: 'conflict_check', reason: 'auto-advanced by conflict check' } })
    await supabase.from('matter_stage_history').insert({ matter_id: matter.id, from_stage: 'lead', to_stage: 'conflict_check', changed_by: guard.profile.id })
  }
  if (submission && submission.intake_stage === 'received') {
    await supabase.from('submissions').update({ intake_stage: 'conflict_check' }).eq('id', submission.id)
    await supabase.from('submission_events').insert({ submission_id: submission.id, type: 'status_changed', detail: 'received -> conflict_check', actor_id: guard.profile.id })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('approve_conflict_waiver')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { id, decision, decision_notes } = body
  if (!id || !decision) return NextResponse.json({ error: 'id and decision are required' }, { status: 400 })
  if (!['proceed', 'proceed_with_conditions', 'declined'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('conflict_checks')
    .update({
      decision,
      decision_notes: decision_notes || null,
      decided_by: guard.profile.id,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'conflict_checks', record_id: id, action: 'UPDATE', new_data: { decision, decision_notes } })

  // A decision to proceed on a pre-matter check is what actually moves the
  // intake pipeline forward, same "the action IS the transition" pattern
  // as running the search in the first place.
  if (data.submission_id && (decision === 'proceed' || decision === 'proceed_with_conditions')) {
    const { data: sub } = await supabase.from('submissions').select('intake_stage').eq('id', data.submission_id).single()
    if (sub?.intake_stage === 'conflict_check') {
      await supabase.from('submissions').update({ intake_stage: 'problem_identification' }).eq('id', data.submission_id)
      await supabase.from('submission_events').insert({ submission_id: data.submission_id, type: 'status_changed', detail: 'conflict_check -> problem_identification', actor_id: guard.profile.id })
    }
  } else if (data.submission_id && decision === 'declined') {
    await supabase.from('submissions').update({ intake_stage: 'declined' }).eq('id', data.submission_id)
    await supabase.from('submission_events').insert({ submission_id: data.submission_id, type: 'status_changed', detail: 'conflict_check -> declined', actor_id: guard.profile.id })
  }

  return NextResponse.json(data)
}
