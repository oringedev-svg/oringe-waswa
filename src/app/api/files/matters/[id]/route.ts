import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { getSessionProfile } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { saveRevision, getRevisions } from '@/lib/revisions'
import { canTransition, stagePermission, type MatterStage } from '@/lib/matterLifecycle'
import { emitAndProcess } from '@/lib/triggerEngine'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'

const REVISIONED_FIELDS = ['title', 'description', 'opposing_party', 'court', 'case_number', 'tags', 'county', 'claim_value'] as const

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const scope = await getMatterAccessScope(profile)
  if (!canAccessMatter(scope, params.id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('legal_matters')
    .select('*, assigned_attorney:assigned_attorney_id(full_name, position, email), people:matter_people(*, profile:profiles(id, full_name, email, role, user_id))')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const [revisions, { data: stageHistory }] = await Promise.all([
    getRevisions('legal_matters', params.id),
    supabase
      .from('matter_stage_history')
      .select('from_stage, to_stage, created_at, actor:profiles(full_name)')
      .eq('matter_id', params.id)
      .order('created_at', { ascending: true }),
  ])

  // The client's original instruction and every piece of feedback sent to
  // them, the matter's story starts at the website request, not at intake.
  let submission = null
  if (data.submission_id) {
    // intake_stage (migration 017) may not exist yet, if that column is
    // missing the whole select 400s. Fall back to the select that always
    // worked rather than losing this card, the same resilience rule as
    // every other new-column addition this project has made.
    let sub
    ;({ data: sub } = await supabase
      .from('submissions')
      .select('id, tracking_code, type, submitter_name, submitter_email, data, intake_stage, created_at')
      .eq('id', data.submission_id)
      .single())
    if (!sub) {
      ;({ data: sub } = await supabase
        .from('submissions')
        .select('id, tracking_code, type, submitter_name, submitter_email, data, created_at')
        .eq('id', data.submission_id)
        .single())
    }
    const { data: updates } = await supabase
      .from('submission_updates')
      .select('status, message, is_public, created_at')
      .eq('submission_id', data.submission_id)
      .order('created_at', { ascending: true })
    if (sub) submission = { ...sub, updates: updates || [] }
  }

  return NextResponse.json({ ...data, revisions, stage_history: stageHistory || [], submission })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const scope = await getMatterAccessScope(profile)
  if (!canAccessMatter(scope, params.id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  // Editing matter fields (not just workflow-gated stage transitions below)
  // is a manage_matters action, same permission that gates creating one.
  const canEdit = profile.role === 'admin' || (await userHasPermission(profile.userId, profile.role, 'manage_matters'))
  if (!canEdit) {
    return NextResponse.json({ error: 'Missing permission: manage_matters' }, { status: 403 })
  }
  const body = await req.json()
  const supabase = createAdminClient()

  // county/claim_value (migration 018) may not exist yet, if that column
  // is missing the whole select 400s. Fall back to the select that always
  // worked rather than breaking every matter PATCH, the same resilience
  // rule as every other new-column addition this project has made.
  let current
  ;({ data: current } = await supabase
    .from('legal_matters')
    .select('status, title, description, opposing_party, court, case_number, tags, county, claim_value, litigation_status')
    .eq('id', params.id)
    .single())
  if (!current) {
    ;({ data: current } = await supabase
      .from('legal_matters')
      .select('status, title, description, opposing_party, court, case_number, tags')
      .eq('id', params.id)
      .single())
  }
  if (!current) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })

  const fromStage = current.status as MatterStage
  const toStage = body.status as MatterStage | undefined
  const isTransition = toStage !== undefined && toStage !== fromStage

  if (isTransition) {
    if (!canTransition(fromStage, toStage!)) {
      return NextResponse.json({ error: `Cannot move a matter from "${fromStage}" to "${toStage}"` }, { status: 400 })
    }

    const requiredPermission = stagePermission(fromStage, toStage!)
    const allowed = await userHasPermission(profile.userId, profile.role, requiredPermission)
    if (!allowed) {
      return NextResponse.json({ error: `Missing permission: ${requiredPermission}` }, { status: 403 })
    }

    // Professional obligation: don't let a matter past the conflict-check
    // stage without a documented decision to proceed.
    if (fromStage === 'conflict_check' && toStage === 'engagement_letter') {
      const { data: checks } = await supabase
        .from('conflict_checks')
        .select('decision')
        .eq('matter_id', params.id)
        .in('decision', ['proceed', 'proceed_with_conditions'])
        .limit(1)
      if (!checks || checks.length === 0) {
        return NextResponse.json({ error: 'A conflict check with a documented decision to proceed is required before opening an engagement letter.' }, { status: 400 })
      }
    }
  }

  const changed = current && REVISIONED_FIELDS.some((f) => f in body && JSON.stringify(body[f]) !== JSON.stringify((current as Record<string, unknown>)[f]))
  if (changed) {
    await saveRevision('legal_matters', params.id, current as unknown as Record<string, unknown>, profile?.id)
  }

  const { data, error } = await supabase
    .from('legal_matters')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'legal_matters', record_id: params.id, action: 'UPDATE', new_data: body })

  if (isTransition) {
    await supabase.from('matter_stage_history').insert({
      matter_id: params.id,
      from_stage: fromStage,
      to_stage: toStage,
      changed_by: profile.id,
    })
    // The same fact, recorded in the domain's own language on the event
    // log, so Matter's timeline can be projected from events rather than
    // from a separately-maintained history table (Principles 2 and 4).
    // matter_stage_history stays for now; it is the read model this event
    // will eventually be projected into rather than written alongside.
    await emitAndProcess({
      aggregateType: 'Matter',
      aggregateId: params.id,
      eventType: 'MatterStageChanged.v1',
      actor: profile.id,
      matterId: params.id,
      payload: { from_stage: fromStage, to_stage: toStage },
    })
  }

  // Litigation status is a different axis from the engagement stage, so it
  // is its own event rather than being folded into the one above.
  if (body.litigation_status && body.litigation_status !== (current as Record<string, unknown>).litigation_status) {
    await emitAndProcess({
      aggregateType: 'Matter',
      aggregateId: params.id,
      eventType: 'MatterLitigationStatusChanged.v1',
      matterId: params.id,
      actor: profile.id,
      payload: {
        from: (current as Record<string, unknown>).litigation_status ?? null,
        to: body.litigation_status,
        court_id: body.court_id ?? null,
        case_number: body.case_number ?? null,
      },
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const canDelete = profile.role === 'admin' || (await userHasPermission(profile.userId, profile.role, 'manage_matters'))
  if (!canDelete) {
    return NextResponse.json({ error: 'Missing permission: manage_matters' }, { status: 403 })
  }
  const supabase = createAdminClient()

  const { data: current } = await supabase
    .from('legal_matters')
    .select('status')
    .eq('id', params.id)
    .single()
  if (!current) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })

  const { error } = await supabase
    .from('legal_matters')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'legal_matters', record_id: params.id, action: 'DELETE' })

  if (current.status !== 'archived') {
    await supabase.from('matter_stage_history').insert({
      matter_id: params.id,
      from_stage: current.status,
      to_stage: 'archived',
      changed_by: profile?.id || null,
    })
  }

  return NextResponse.json({ success: true })
}
