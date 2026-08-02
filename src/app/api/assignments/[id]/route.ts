import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile, isAdminRole, type SessionProfile } from '@/lib/auth'
import { evaluateAndAdvanceMatterStage, evaluateAndAdvanceIntakeStage } from '@/lib/workflowCompletion'
import { userHasPermission } from '@/lib/permissions'
import { buildAssignmentBrief } from '@/lib/assignmentBrief'
import { stageLabel as matterStageLabelOf } from '@/lib/matterLifecycle'
import { intakeStageMeta } from '@/lib/intakeLifecycle'

// Assignments are visible to: the assigner, the assignee, or anyone in an
// admin-tier role. requireAdminApi() alone would exclude pupils and admin
// assistants, who are exactly who assignments are routinely handed to, so
// this checks the specific relationship instead of just the caller's role.
async function resolveAccess(profile: SessionProfile, assignment: { assigned_by: string; assigned_to: string | null }) {
  const supabase = createAdminClient()
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  const teamMemberId = teamMember?.id ?? null
  const isParty = assignment.assigned_by === profile.id || (!!teamMemberId && assignment.assigned_to === teamMemberId)
  const allowed = isParty || isAdminRole(profile.role)
  return { allowed, teamMemberId }
}

// GET a single assignment with its messages, linked documents, and the
// full case file it belongs to: like handing over the physical file to
// whoever picks up the work, not just a slip with the task on it. Includes
// the matter's own details and stage history when there's a matter, and
// the originating submission's intake data and history either way.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: assignment, error } = await supabase
    .from('assignments')
    .select(`
      *,
      assigned_by_user:assigned_by(full_name, email),
      assignee:assigned_to(id, full_name, position),
      messages:assignment_messages(id, sender_id, message_type, content, created_at),
      work_item:work_items(id, activity_type:activity_types(name, description)),
      matter:legal_matters(
        id, matter_number, title, type, status, description, client_name,
        opposing_party, court, case_number, county, claim_value, is_confidential,
        opening_date, submission_id, assigned_attorney:team_members(full_name, position)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { allowed, teamMemberId } = await resolveAccess(profile, assignment)
  if (!allowed) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Part D: an assignee who isn't also the assigner or an admin-tier/
  // manage_matters user gets a curated slice of the matter, not the whole
  // record, they see enough to do the work (summary, timeline, documents,
  // client, brief) and nothing beyond that, per the same "one assignment
  // shouldn't grant the whole matter" principle getMatterAccessScope()
  // already applies to matter access at large.
  const isAssignee = !!teamMemberId && assignment.assigned_to === teamMemberId
  const isAssigner = assignment.assigned_by === profile.id
  const hasManageMatters = isAdminRole(profile.role) || await userHasPermission(profile.userId, profile.role, 'manage_matters')
  const isPrivilegedViewer = isAssigner || hasManageMatters

  // Fill in the rest of the file: the matter's stage history, its own
  // documents (not just ones attached to this assignment), and whichever
  // submission started all this, promoted or not.
  const matterId: string | null = assignment.matter?.id ?? null
  const submissionId: string | null = assignment.submission_id ?? assignment.matter?.submission_id ?? null

  const [stageHistoryRes, matterDocsRes, conflictChecksRes, submissionRes, teamRes] = await Promise.all([
    matterId
      ? supabase
          .from('matter_stage_history')
          .select('from_stage, to_stage, created_at, actor:profiles(full_name)')
          .eq('matter_id', matterId)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    matterId
      ? supabase
          .from('legal_documents')
          .select('id, title, type, file_url, file_name, assignment_id, created_at, uploader:profiles(full_name)')
          .eq('matter_id', matterId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    matterId
      ? supabase
          .from('conflict_checks')
          .select('id, search_query, highest_risk, decision, decision_notes, created_at')
          .eq('matter_id', matterId)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    submissionId
      ? supabase
          .from('submissions')
          .select('id, tracking_code, type, submitter_name, submitter_email, data, intake_stage, created_at, updates:submission_updates(status, message, is_public, created_at)')
          .eq('id', submissionId)
          .single()
      : Promise.resolve({ data: null }),
    matterId
      ? supabase.from('matter_people').select('role, profile:profiles(full_name)').eq('matter_id', matterId)
      : Promise.resolve({ data: [] }),
  ])

  const allMatterDocs = matterDocsRes.data || []
  const workItem = Array.isArray(assignment.work_item) ? assignment.work_item[0] : assignment.work_item
  const activityType = workItem ? (Array.isArray(workItem.activity_type) ? workItem.activity_type[0] : workItem.activity_type) : null

  const brief = buildAssignmentBrief({
    stageKey: assignment.stage_key,
    isMatter: !!matterId,
    matterTitle: assignment.matter?.title,
    matterDescription: assignment.matter?.description,
    clientName: assignment.matter?.client_name || submissionRes.data?.submitter_name,
    activityTypeName: activityType?.name ?? null,
    activityTypeDescription: activityType?.description ?? null,
    instructions: assignment.instructions,
  })

  const currentStageLabel = assignment.stage_key
    ? (matterId ? matterStageLabelOf(assignment.stage_key) : intakeStageMeta(assignment.stage_key).label)
    : null

  // A crude but honest priority signal: there's no dedicated priority field
  // anywhere in this schema (work_items has "urgency", assignments doesn't),
  // so this is computed from due_date proximity using that same vocabulary
  // rather than inventing a second, redundant stored field.
  let priority: 'overdue' | 'due_soon' | 'normal' | 'none' = 'none'
  if (assignment.due_date) {
    const days = (new Date(assignment.due_date).getTime() - Date.now()) / 86400000
    priority = days < 0 ? 'overdue' : days <= 2 ? 'due_soon' : 'normal'
  }

  const responseBody: Record<string, unknown> = {
    ...assignment,
    currentStageLabel,
    priority,
    brief,
    matterStageHistory: stageHistoryRes.data || [],
    matterDocuments: allMatterDocs,
    assignmentDocuments: allMatterDocs.filter(d => d.assignment_id === params.id),
    conflictChecks: conflictChecksRes.data || [],
    submission: submissionRes.data || null,
    assignedTeam: teamRes.data || [],
  }

  if (!isPrivilegedViewer) {
    // Trim what an assignee-only viewer receives: no claim value, no
    // privileged conflict-decision notes, no client contact details beyond
    // their name, matches Part D's "read-only, limited to what's needed."
    if (responseBody.matter) {
      const { claim_value: _cv, is_confidential: _ic, ...restMatter } = responseBody.matter as Record<string, unknown>
      void _cv; void _ic
      responseBody.matter = restMatter
    }
    responseBody.conflictChecks = (responseBody.conflictChecks as { decision_notes?: string }[]).map(
      c => ({ ...c, decision_notes: null }),
    )
    if (responseBody.submission) {
      const { submitter_email: _e, ...restSub } = responseBody.submission as Record<string, unknown>
      void _e
      responseBody.submission = restSub
    }
  }

  return NextResponse.json(responseBody)
}

// PATCH: Update assignment status (state transitions)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { action, message, rejection_reason } = await req.json()

  const supabase = createAdminClient()

  // Fetch current assignment
  const { data: assignment, error: fetchError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const { allowed, teamMemberId } = await resolveAccess(profile, assignment)
  if (!allowed) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Validate state transitions and permissions
  let newStatus = assignment.status
  let updates: Record<string, any> = { updated_at: new Date().toISOString() }
  let systemMessage = ''

  switch (action) {
    case 'accept':
      if (assignment.status !== 'Assigned') {
        return NextResponse.json(
          { error: `Cannot accept assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_to !== teamMemberId) {
        return NextResponse.json(
          { error: 'Only the assignee can accept an assignment' },
          { status: 403 }
        )
      }
      newStatus = 'Accepted'
      updates.accepted_at = new Date().toISOString()
      systemMessage = `${profile.fullName} accepted this assignment`
      break

    case 'start':
      if (assignment.status !== 'Accepted') {
        return NextResponse.json(
          { error: `Cannot start assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_to !== teamMemberId) {
        return NextResponse.json(
          { error: 'Only the assignee can start work' },
          { status: 403 }
        )
      }
      newStatus = 'In Progress'
      updates.started_at = new Date().toISOString()
      systemMessage = `${profile.fullName} started work on this assignment`
      break

    case 'submit':
      if (assignment.status !== 'In Progress') {
        return NextResponse.json(
          { error: `Cannot submit assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_to !== teamMemberId) {
        return NextResponse.json(
          { error: 'Only the assignee can submit work' },
          { status: 403 }
        )
      }
      newStatus = 'Submitted'
      updates.submitted_at = new Date().toISOString()
      systemMessage = `${profile.fullName} submitted work for review`
      break

    case 'approve':
      if (assignment.status !== 'Submitted') {
        return NextResponse.json(
          { error: `Cannot approve assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_by !== profile.id) {
        return NextResponse.json(
          { error: 'Only the assigner can approve work' },
          { status: 403 }
        )
      }
      newStatus = 'Approved'
      updates.completed_at = new Date().toISOString()
      systemMessage = `${profile.fullName} approved this work`
      break

    case 'reject':
      if (assignment.status !== 'Submitted') {
        return NextResponse.json(
          { error: `Cannot reject assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_by !== profile.id) {
        return NextResponse.json(
          { error: 'Only the assigner can reject work' },
          { status: 403 }
        )
      }
      newStatus = 'Rejected'
      updates.completed_at = new Date().toISOString()
      updates.rejected_by = profile.id
      updates.rejection_reason = rejection_reason || 'Work does not meet requirements'
      systemMessage = `${profile.fullName} rejected this work: ${updates.rejection_reason}`
      break

    case 'revoke':
      if (assignment.status === 'Approved' || assignment.status === 'Revoked' || assignment.status === 'Cancelled') {
        return NextResponse.json(
          { error: `Cannot revoke assignment in ${assignment.status} status` },
          { status: 400 }
        )
      }
      if (assignment.assigned_by !== profile.id) {
        return NextResponse.json(
          { error: 'Only the assigner can revoke an assignment' },
          { status: 403 }
        )
      }
      newStatus = 'Revoked'
      updates.revoked_at = new Date().toISOString()
      systemMessage = `${profile.fullName} revoked this assignment`
      break

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Update assignment status
  updates.status = newStatus
  const { data: updated, error: updateError } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Add system message and optional user message
  const messages = [
    {
      assignment_id: params.id,
      sender_id: profile.id,
      message_type: 'System',
      content: systemMessage,
    },
  ]

  if (message) {
    messages.push({
      assignment_id: params.id,
      sender_id: profile.id,
      message_type: action === 'approve' ? 'Decision' : action === 'reject' ? 'Review' : 'Comment',
      content: message,
    })
  }

  await supabase.from('assignment_messages').insert(messages)

  // Workflow completion engine: does approving this assignment satisfy the
  // current stage's completion requirements, and if so, advance the matter
  // (or the pre-matter intake pipeline) to the next stage. Nothing to
  // evaluate for an assignment that wasn't tagged with a stage (generic
  // work not tied to a specific lifecycle step).
  let advanceResult: Awaited<ReturnType<typeof evaluateAndAdvanceMatterStage>> | null = null
  if (action === 'approve' && assignment.stage_key) {
    if (assignment.matter_id) {
      advanceResult = await evaluateAndAdvanceMatterStage(supabase, {
        matterId: assignment.matter_id, stageKey: assignment.stage_key, assignmentId: params.id, actorId: profile.id,
      })
    } else if (assignment.submission_id) {
      advanceResult = await evaluateAndAdvanceIntakeStage(supabase, {
        submissionId: assignment.submission_id, stageKey: assignment.stage_key, assignmentId: params.id, actorId: profile.id,
      })
    }
  }

  // Approving an assignment that executes a work item completes the work
  // item and emits whatever business event its activity type specifies,
  // e.g. approving a "Draft Demand Letter" assignment emits
  // 'demand_letter_sent', which is what actually moves the matter forward,
  // not the approval itself. Falls back to a generic event only when the
  // activity type has none configured.
  if (action === 'approve' && assignment.work_item_id) {
    const { data: workItem } = await supabase
      .from('work_items')
      .select('id, matter_id, submission_id, activity_type_id, activity_type:activity_types(on_complete_event)')
      .eq('id', assignment.work_item_id)
      .single()

    if (workItem) {
      await supabase
        .from('work_items')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', workItem.id)

      let matterType: string | null = null
      if (workItem.matter_id) {
        const { data: matter } = await supabase.from('legal_matters').select('type').eq('id', workItem.matter_id).maybeSingle()
        matterType = matter?.type ?? null
      }

      const activityTypeRow = Array.isArray(workItem.activity_type) ? workItem.activity_type[0] : workItem.activity_type
      const eventType = (activityTypeRow as { on_complete_event: string | null } | undefined)?.on_complete_event
        || 'WorkItemCompleted.v1'

      const { emitAndProcess } = await import('@/lib/triggerEngine')
      await emitAndProcess({
        aggregateType: workItem.matter_id ? 'Matter' : 'Submission',
        aggregateId: workItem.matter_id || workItem.submission_id,
        eventType,
        actor: profile.id,
        matterId: workItem.matter_id,
        submissionId: workItem.submission_id,
        matterType,
        payload: { work_item_id: workItem.id, assignment_id: params.id },
      })
    }
  }

  // _stageAdvanced is not a column, it's reported once so the assignment
  // page can tell the approver what just happened elsewhere in the app,
  // including when it did NOT advance because a gate is still unmet, not
  // just when it did.
  return NextResponse.json({ ...updated, _stageAdvanced: advanceResult })
}
