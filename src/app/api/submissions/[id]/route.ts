import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendEmail, statusUpdateEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { getSessionProfile, requireAdminApi } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { canTransitionIntake, intakeStagePermission, type IntakeStage } from '@/lib/intakeLifecycle'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  // The base submission never depends on the activity-timeline feature:
  // events/first-open tracking (migration 014) is fetched and written
  // separately and defensively, so a not-yet-applied migration degrades to
  // "no timeline shown" instead of breaking the whole page.
  const { data, error } = await supabase
    .from('submissions')
    .select('*, assigned_member:team_members(full_name, position, avatar_url), updates:submission_updates(*)')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  data.events = []
  try {
    const { data: events, error: eventsError } = await supabase
      .from('submission_events')
      .select('*, actor:profiles(full_name)')
      .eq('submission_id', params.id)
      .order('created_at', { ascending: true })
    if (!eventsError) data.events = events || []

    // First-open tracking: the moment staff actually looks at an inquiry,
    // not just when it arrived, the "time to first open" signal from the
    // intake workflow. Only fires once per submission, and bumps a fresh
    // pending submission into review so triage state reflects reality.
    if (!eventsError && !data.first_opened_at) {
      const profile = await getSessionProfile()
      if (profile) {
        const patch: Record<string, unknown> = { first_opened_at: new Date().toISOString(), first_opened_by: profile.id }
        if (data.status === 'pending') patch.status = 'under_review'
        await supabase.from('submissions').update(patch).eq('id', params.id)
        await supabase.from('submission_events').insert({ submission_id: params.id, type: 'opened', actor_id: profile.id })
        Object.assign(data, patch)
        data.events = [...data.events, { type: 'opened', created_at: patch.first_opened_at, actor: { full_name: profile.fullName } }]
      }
    }
  } catch {
    // Migration 014 not applied yet, or a transient error. The submission
    // itself already loaded successfully above, so just show it without a
    // timeline rather than failing the whole page.
  }

  data.notes = []
  try {
    const { data: notes, error: notesError } = await supabase
      .from('submission_notes')
      .select('id, content, stage, created_at, author:profiles(full_name)')
      .eq('submission_id', params.id)
      .order('created_at', { ascending: true })
    if (!notesError) data.notes = notes || []
  } catch {
    // Migration 017 not applied yet, same degrade-gracefully rule.
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const profile = await getSessionProfile()
  const body = await req.json()
  const { status, message, is_public = true, assigned_to, internal_notes, restore, intake_stage, intake_note } = body

  const { data: before } = await supabase.from('submissions').select('status, assigned_to, intake_stage').eq('id', params.id).single()
  if (!before) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  // Advancing the intake pipeline is a validated transition, same pattern
  // as the matter lifecycle: only defined moves are allowed, and moving
  // past the pipeline's non-search steps needs the base submissions
  // permission (conflict_check itself is gated separately, on the search
  // endpoint that actually performs it).
  if (intake_stage) {
    const from = before.intake_stage as IntakeStage
    const to = intake_stage as IntakeStage
    if (!canTransitionIntake(from, to)) {
      return NextResponse.json({ error: `Cannot move this enquiry from "${from}" to "${to}"` }, { status: 400 })
    }
    if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const requiredPermission = intakeStagePermission(from, to)
    const allowed = await userHasPermission(profile.userId, profile.role, requiredPermission)
    if (!allowed) return NextResponse.json({ error: `Missing permission: ${requiredPermission}` }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (assigned_to !== undefined) updateData.assigned_to = assigned_to
  if (internal_notes !== undefined) updateData.internal_notes = internal_notes
  if (restore) updateData.deleted_at = null
  if (intake_stage) updateData.intake_stage = intake_stage

  const { data: submission, error } = await supabase
    .from('submissions')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'submissions', record_id: params.id, action: 'UPDATE', new_data: updateData })

  if (intake_stage) {
    try {
      await supabase.from('submission_events').insert({ submission_id: params.id, type: 'status_changed', detail: `${before.intake_stage} -> ${intake_stage}`, actor_id: profile?.id || null })
      if (intake_note?.trim()) {
        await supabase.from('submission_notes').insert({ submission_id: params.id, content: intake_note.trim(), stage: intake_stage, author_id: profile?.id || null })
      }
    } catch {}
  }

  // Activity timeline entries, only for changes that actually happened.
  const events: { submission_id: string; type: string; detail: string | null; actor_id: string | null }[] = []
  if (status && before && status !== before.status) {
    events.push({ submission_id: params.id, type: 'status_changed', detail: `${before.status} -> ${status}`, actor_id: profile?.id || null })
  }
  if (assigned_to !== undefined && assigned_to !== before?.assigned_to) {
    let detail = 'Unassigned'
    if (assigned_to) {
      const { data: member } = await supabase.from('team_members').select('full_name').eq('id', assigned_to).single()
      detail = `Assigned to ${member?.full_name || 'a team member'}`
    }
    events.push({ submission_id: params.id, type: 'assigned', detail, actor_id: profile?.id || null })
  }
  // Best-effort: the timeline is a nice-to-have layered on the status
  // update, not a precondition for it. If migration 014 hasn't been applied
  // yet, this fails silently rather than blocking the actual status change.
  if (events.length > 0) {
    try {
      await supabase.from('submission_events').insert(events)
    } catch {}
  }

  // Add update record
  if (status && message) {
    await supabase.from('submission_updates').insert({
      submission_id: params.id,
      status,
      message,
      is_public,
      sent_email: is_public,
    })

    // Send email if public
    if (is_public) {
      try {
        await sendEmail({
          to: submission.submitter_email,
          subject: `Update on Your Submission, ${submission.tracking_code}`,
          html: statusUpdateEmail({
            name: submission.submitter_name,
            type: submission.type,
            trackingCode: submission.tracking_code,
            status,
            message,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
          }),
        })
      } catch (e) {
        console.warn('Email failed:', e)
      }
    }
  }

  return NextResponse.json(submission)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('submissions').update({ deleted_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'submissions', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
