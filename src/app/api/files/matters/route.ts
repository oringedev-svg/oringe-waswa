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

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const matter_number = generateMatterNumber()

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
  const defaultStatus = body.submission_id ? 'lead' : 'open'

  // county/claim_value (migration 018) may not exist yet on some deployments
  //, opening a matter is the primary entry point into this whole app, it
  // must never fail because of a migration that hasn't been run. Retry
  // without those two fields if the insert 400s on them specifically.
  const insertPayload = { status: defaultStatus, ...body, matter_number }
  let { data, error } = await supabase.from('legal_matters').insert(insertPayload).select().single()
  if (error && (error.message?.includes('county') || error.message?.includes('claim_value'))) {
    const { county, claim_value, ...fallbackPayload } = insertPayload
    void county; void claim_value
    ;({ data, error } = await supabase.from('legal_matters').insert(fallbackPayload).select().single())
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'legal_matters', record_id: data.id, action: 'INSERT', new_data: body })

  // Start the stage clock, cycle-time analytics need to know when this
  // matter entered its first stage.
  await supabase.from('matter_stage_history').insert({
    matter_id: data.id,
    from_stage: null,
    to_stage: data.status,
    changed_by: guard.profile.id,
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
          .upsert({ matter_id: data.id, profile_id: profile.id, role: 'client' }, { onConflict: 'matter_id,profile_id', ignoreDuplicates: true })
      }
    }

    // Close the loop on the submission's own timeline: it becomes read-only
    // in spirit once it's a matter, and the "promoted" event is the last
    // entry in its story before the matter's own story takes over.
    await supabase
      .from('submission_events')
      .insert({ submission_id: body.submission_id, type: 'promoted', detail: `Promoted to matter ${data.matter_number}`, actor_id: guard.profile.id })

    // The intake pipeline and the matter lifecycle are one continuous line:
    // mark the submission's side of it done, and carry forward any conflict
    // checks already run pre-matter onto the new matter rather than losing
    // that audit trail. Both best-effort, migration 017 may not be applied.
    try {
      await supabase.from('submissions').update({ intake_stage: 'promoted' }).eq('id', body.submission_id)
    } catch {}
    try {
      await supabase.from('conflict_checks').update({ matter_id: data.id }).eq('submission_id', body.submission_id).is('matter_id', null)
    } catch {}
    // Same for anything uploaded during intake (a conflict-search screenshot,
    // a document an assignment produced pre-matter): link the existing rows
    // to the new matter rather than re-uploading, so Matter Documents shows
    // them and its count is correct immediately, with nothing duplicated.
    try {
      await supabase.from('legal_documents').update({ matter_id: data.id }).eq('submission_id', body.submission_id).is('matter_id', null)
    } catch {}
  }

  return NextResponse.json(data, { status: 201 })
}
