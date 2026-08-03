import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { generateMatterNumber } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { requirePermissionApi, getSessionProfile } from '@/lib/auth'
import { getMatterAccessScope } from '@/lib/matterScope'

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const scope = await getMatterAccessScope(profile)
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)

  // ?counts=stages returns per-stage counts plus the average number of days
  // matters have been sitting in each stage, the bottleneck signal.
  if (searchParams.get('counts') === 'stages') {
    if (!scope.all && scope.matterIds.length === 0) {
      return NextResponse.json({ counts: {}, avgDays: {} })
    }
    let mattersQuery = supabase.from('legal_matters').select('id, status')
    let historyQuery = supabase.from('matter_stage_history').select('matter_id, created_at').order('created_at', { ascending: false })
    if (!scope.all) {
      mattersQuery = mattersQuery.in('id', scope.matterIds)
      historyQuery = historyQuery.in('matter_id', scope.matterIds)
    }
    const [{ data: matters, error }, { data: history }] = await Promise.all([mattersQuery, historyQuery])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Latest history row per matter = when it entered its current stage.
    const enteredAt = new Map<string, string>()
    for (const h of history || []) {
      if (!enteredAt.has(h.matter_id)) enteredAt.set(h.matter_id, h.created_at)
    }

    const counts: Record<string, number> = {}
    const daySums: Record<string, { total: number; n: number }> = {}
    const now = Date.now()
    for (const m of matters || []) {
      counts[m.status] = (counts[m.status] || 0) + 1
      const entered = enteredAt.get(m.id)
      if (entered) {
        const days = (now - new Date(entered).getTime()) / 86400000
        const bucket = daySums[m.status] || { total: 0, n: 0 }
        bucket.total += days
        bucket.n += 1
        daySums[m.status] = bucket
      }
    }
    const avgDays: Record<string, number> = {}
    for (const [stage, { total, n }] of Object.entries(daySums)) {
      avgDays[stage] = Math.round((total / n) * 10) / 10
    }

    return NextResponse.json({ counts, avgDays })
  }

  if (!scope.all && scope.matterIds.length === 0) {
    return NextResponse.json({ data: [], count: 0 })
  }

  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const attorney_id = searchParams.get('attorney_id')
  const search = searchParams.get('search')
  const submission_id = searchParams.get('submission_id')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabase
    .from('legal_matters')
    .select('*, assigned_attorney:team_members(full_name, position)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (!scope.all) query = query.in('id', scope.matterIds)
  if (type) query = query.eq('type', type)
  if (status) query = query.eq('status', status)
  if (attorney_id) query = query.eq('assigned_attorney_id', attorney_id)
  if (submission_id) query = query.eq('submission_id', submission_id)
  if (search) query = query.or(`title.ilike.%${search}%,client_name.ilike.%${search}%,matter_number.ilike.%${search}%`)

  let { data, error, count } = await query

  // The matter list must remain usable if the optional assignee relation is
  // unavailable on a partially migrated database. Counts and the base rows
  // are still valid; retrying without that display-only join is safer than
  // turning a database-shape mismatch into an empty-looking matter register.
  if (error) {
    let fallback = supabase
      .from('legal_matters')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    if (!scope.all) fallback = fallback.in('id', scope.matterIds)
    if (type) fallback = fallback.eq('type', type)
    if (status) fallback = fallback.eq('status', status)
    if (attorney_id) fallback = fallback.eq('assigned_attorney_id', attorney_id)
    if (submission_id) fallback = fallback.eq('submission_id', submission_id)
    if (search) fallback = fallback.or(`title.ilike.%${search}%,client_name.ilike.%${search}%,matter_number.ilike.%${search}%`)
    ;({ data, error, count } = await fallback)
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [], count: count || 0 })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const matter_number = generateMatterNumber()

  // An engagement is optional in the UI, but the data model retains the
  // wrapper even for a standalone instruction. We only reuse an engagement
  // when its ID was explicitly supplied by the staff member.
  let engagementId = body.engagement_id || null
  if (!engagementId) {
    const objective = body.engagement_objective || body.title || 'Single-matter engagement'
    const { data: engagement, error: engagementError } = await supabase
      .from('engagements')
      .insert({ client_id: body.client_id || null, objective_summary: objective, is_system_created: !body.engagement_objective, created_by: guard.profile.id })
      .select('id')
      .single()
    // Engagements were added after the original matter register. A failed
    // optional wrapper must never prevent a valid matter from being opened
    // on an installation that has not yet applied the reference migration.
    if (engagementError) console.warn('[matters] engagement link unavailable:', engagementError.message)
    else engagementId = engagement.id
  }

  // Professional obligation, same rule as the matter's own lifecycle: an
  // enquiry a partner has already declined at conflict check must not be
  // promoted into a live matter behind that decision's back. Best-effort,
  // if intake_stage (migration 017/018) doesn't exist yet, there's nothing
  // to check, so this never blocks promotion on an older deployment.
  if (body.submission_id) {
    const { data: sub } = await supabase.from('submissions').select('intake_stage').eq('id', body.submission_id).single()
    if (sub?.intake_stage === 'declined') {
      return NextResponse.json({ error: 'This enquiry was declined at conflict check and cannot be promoted to a matter.' }, { status: 400 })
    }
  }

  // A matter created from a public submission starts as an unvetted lead;
  // one opened directly by staff is already a deliberate, vetted decision,
  // so it can start active unless the caller says otherwise.
  // Every new matter begins with the conflict gate. Direct staff opening is
  // not a conflict waiver: only an auditable, area-complete decision clears
  // it into the engagement path.
  const defaultStatus = 'lead'

  // county/claim_value (migration 018) may not exist yet on some deployments
  //, opening a matter is the primary entry point into this whole app, it
  // must never fail because of a migration that hasn't been run. Retry
  // without those two fields if the insert 400s on them specifically.
  const {
    engagement_objective,
    engagement_id: _requestedEngagementId,
    practice_area_ids: _practiceAreaIds,
    practice_area_id,
    matter_type_id,
    ...matterBody
  } = body
  void engagement_objective
  // `practice_area_ids` belongs only to matter_practice_areas. Keep it out
  // of the legal_matters insert, then progressively fall back to the
  // long-standing schema if the optional reference columns are unavailable.
  const legacyPayload = { status: defaultStatus, ...matterBody, matter_number }
  const referencePayload = {
    ...legacyPayload,
    ...(engagementId ? { engagement_id: engagementId } : {}),
    ...(typeof practice_area_id === 'string' && practice_area_id ? { practice_area_id } : {}),
    ...(typeof matter_type_id === 'string' && matter_type_id ? { matter_type_id } : {}),
  }
  const compactLegacyPayload = (() => {
    const { county, claim_value, ...payload } = legacyPayload
    void county; void claim_value
    return payload
  })()
  let data: Record<string, unknown> | null = null
  let error: { message?: string } | null = null
  for (const payload of [referencePayload, legacyPayload, compactLegacyPayload]) {
    const result = await supabase.from('legal_matters').insert(payload).select().single()
    data = result.data
    error = result.error
    if (!error) break
  }

  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not create matter' }, { status: 500 })
  const createdMatter = data as { id: string; status: string; matter_number: string }
  await logAudit({ table_name: 'legal_matters', record_id: createdMatter.id, action: 'INSERT', new_data: body })

  // `practice_area_id` remains the primary/legacy compatibility field. The
  // junction table lets one matter genuinely span multiple service lines.
  const practiceAreaIds = Array.from(new Set([
    ...(Array.isArray(body.practice_area_ids) ? body.practice_area_ids : []),
    body.practice_area_id,
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)))
  if (practiceAreaIds.length > 0) {
    const primaryId = body.practice_area_id || practiceAreaIds[0]
    const { error: areasError } = await supabase.from('matter_practice_areas').upsert(
      practiceAreaIds.map(practice_area_id => ({ matter_id: createdMatter.id, practice_area_id, is_primary: practice_area_id === primaryId, added_by: guard.profile.id })),
      { onConflict: 'matter_id,practice_area_id' }
    )
    // The Matter itself is already valid through the long-standing primary
    // field. Keep old deployments usable while making a missing 044 migration
    // observable to operators instead of returning a misleading creation
    // failure after the row has committed.
    if (areasError) console.error('[matters] multi-practice links unavailable:', areasError.message)
  }

  // Start the stage clock, cycle-time analytics need to know when this
  // matter entered its first stage.
  await supabase.from('matter_stage_history').insert({
    matter_id: createdMatter.id,
    from_stage: null,
    to_stage: createdMatter.status,
    changed_by: guard.profile.id,
  })

  // The creator receives an explicit matter-level grant. This makes the
  // security boundary available from the first matter, even while v1 roles
  // still grant broad access to most internal staff.
  await supabase.from('matter_access').upsert({
    matter_id: createdMatter.id,
    profile_id: guard.profile.id,
    access_level: 'manager',
    granted_by: guard.profile.id,
  })

  // A matter promoted from a submission also links the person behind it:
  // find-or-create their client profile by email and attach them to the
  // matter, so the client account exists from the first touch, inviting
  // them to the portal later is one click, not a re-entry of their details.
  if (body.submission_id) {
    const { data: submission } = await supabase
      .from('submissions')
      .select('submitter_name, submitter_email, submitter_phone')
      .eq('id', body.submission_id)
      .single()

    if (submission?.submitter_email) {
      let { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', submission.submitter_email)
        .maybeSingle()

      if (!profile) {
        const { data: created } = await supabase
          .from('profiles')
          .insert({
            full_name: submission.submitter_name,
            email: submission.submitter_email,
            phone: submission.submitter_phone || null,
            role: 'client',
          })
          .select('id')
          .single()
        profile = created
      }

      if (profile) {
        await supabase
          .from('matter_people')
          .upsert({ matter_id: createdMatter.id, profile_id: profile.id, role: 'client' }, { onConflict: 'matter_id,profile_id', ignoreDuplicates: true })
      }
    }

    // Close the loop on the submission's own timeline: it becomes read-only
    // in spirit once it's a matter, and the "promoted" event is the last
    // entry in its story before the matter's own story takes over.
    await supabase
      .from('submission_events')
      .insert({ submission_id: body.submission_id, type: 'promoted', detail: `Promoted to matter ${createdMatter.matter_number}`, actor_id: guard.profile.id })

    // The intake pipeline and the matter lifecycle are one continuous line:
    // mark the submission's side of it done, and carry forward any conflict
    // checks already run pre-matter onto the new matter rather than losing
    // that audit trail. Both best-effort, migration 017 may not be applied.
    try {
      await supabase.from('submissions').update({ intake_stage: 'promoted' }).eq('id', body.submission_id)
    } catch {}
    try {
      await supabase.from('conflict_checks').update({ matter_id: createdMatter.id }).eq('submission_id', body.submission_id).is('matter_id', null)
    } catch {}
    // Same for anything uploaded during intake (a conflict-search screenshot,
    // a document an assignment produced pre-matter): link the existing rows
    // to the new matter rather than re-uploading, so Matter Documents shows
    // them and its count is correct immediately, with nothing duplicated.
    try {
      await supabase.from('legal_documents').update({ matter_id: createdMatter.id }).eq('submission_id', body.submission_id).is('matter_id', null)
    } catch {}
  }

  return NextResponse.json(data, { status: 201 })
}
