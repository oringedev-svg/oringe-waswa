import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile, isAdminRole } from '@/lib/auth'

// Default instructions when the caller doesn't write their own, so
// assigning straight off the intake queue never produces a blank, useless
// work item. Varies by submission type since "screen a job application"
// and "respond to a contact enquiry" are different jobs, not the same task
// with a different label.
function defaultInstructionsForSubmission(type: string, submitterName: string): string {
  switch (type) {
    case 'job':
      return `Screen the job application from ${submitterName}.`
    case 'volunteer':
      return `Review the volunteer application from ${submitterName}.`
    case 'paper':
      return `Review the paper/publication submission from ${submitterName}.`
    case 'appointment':
      return `Handle the appointment request from ${submitterName}.`
    case 'contact':
    default:
      return `Review and respond to the enquiry from ${submitterName}.`
  }
}

// POST: Create a new assignment, on a matter, a submission, or both (a
// submission that's already been promoted carries its matter_id along
// automatically). Validates that the assignee is not a client on the matter.
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { matter_id, submission_id, work_item_id, activity_type_id, assigned_to, stage_id, instructions, message, due_date } = await req.json()

  if (!assigned_to || (!matter_id && !submission_id && !work_item_id)) {
    return NextResponse.json(
      { error: 'assigned_to is required, along with matter_id, submission_id, and/or work_item_id' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the assignee exists and is active
  const { data: assignee, error: assigneeError } = await supabase
    .from('team_members')
    .select('id, profile_id, full_name')
    .eq('id', assigned_to)
    .eq('is_active', true)
    .single()

  if (assigneeError || !assignee) {
    return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 404 })
  }

  let resolvedMatterId: string | null = matter_id || null
  let resolvedSubmissionId: string | null = submission_id || null
  let resolvedInstructions: string | null = instructions || null
  let resolvedWorkItemId: string | null = work_item_id || null

  // Assigning a specific activity (e.g. "Draft Demand Letter") from the
  // library, rather than writing free-text instructions, is what starts a
  // work item's life, everything after it (the next activity, the next
  // assignment) then follows from the trigger engine reacting to this one's
  // completion event, not from another manual click.
  if (activity_type_id && !resolvedWorkItemId) {
    if (!resolvedMatterId && !resolvedSubmissionId) {
      return NextResponse.json(
        { error: 'matter_id or submission_id is required to create a work item from an activity type' },
        { status: 400 }
      )
    }
    const { data: activityType, error: activityTypeError } = await supabase
      .from('activity_types')
      .select('id, firm_id, name, description, default_due_days, default_urgency')
      .eq('id', activity_type_id)
      .single()

    if (activityTypeError || !activityType) {
      return NextResponse.json({ error: 'Activity type not found' }, { status: 404 })
    }

    const dueAt = activityType.default_due_days
      ? new Date(Date.now() + activityType.default_due_days * 86400000).toISOString()
      : null

    const { data: workItem, error: createWorkItemError } = await supabase
      .from('work_items')
      .insert({
        firm_id: activityType.firm_id,
        activity_type_id: activityType.id,
        matter_id: resolvedMatterId,
        submission_id: resolvedSubmissionId,
        title: activityType.name,
        instructions: instructions || activityType.description,
        due_at: dueAt,
        urgency: activityType.default_urgency,
        status: 'queued',
      })
      .select('id')
      .single()

    if (createWorkItemError || !workItem) {
      return NextResponse.json({ error: createWorkItemError?.message || 'Could not create work item' }, { status: 500 })
    }
    resolvedWorkItemId = workItem.id
    resolvedInstructions = resolvedInstructions || activityType.description || activityType.name
  }

  // A work item already carries its own matter/submission and a title,
  // an assignment executing one inherits both rather than needing them
  // repeated by the caller.
  if (resolvedWorkItemId) {
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('id, matter_id, submission_id, title, instructions')
      .eq('id', resolvedWorkItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    }

    resolvedMatterId = resolvedMatterId || workItem.matter_id
    resolvedSubmissionId = resolvedSubmissionId || workItem.submission_id
    resolvedInstructions = resolvedInstructions || workItem.instructions || workItem.title
  }

  if (submission_id) {
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('id, type, submitter_name')
      .eq('id', submission_id)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // A submission that's already been promoted has its own matter, tie
    // the assignment to it too so it shows up in the matter's work as well.
    if (!resolvedMatterId) {
      const { data: linkedMatter } = await supabase
        .from('legal_matters')
        .select('id')
        .eq('submission_id', submission_id)
        .maybeSingle()
      resolvedMatterId = linkedMatter?.id ?? null
    }

    if (!resolvedInstructions) {
      resolvedInstructions = defaultInstructionsForSubmission(submission.type, submission.submitter_name)
    }
  }

  // Check if the assignee is a client on this matter (only meaningful once
  // a matter, and therefore matter_people, exists)
  if (resolvedMatterId) {
    const { data: clientLink } = await supabase
      .from('matter_people')
      .select('id')
      .eq('matter_id', resolvedMatterId)
      .eq('profile_id', assignee.profile_id)
      .eq('role', 'client')
      .single()

    if (clientLink) {
      return NextResponse.json(
        { error: 'Cannot assign work to someone who is a client on this matter' },
        { status: 400 }
      )
    }
  }

  // Create the assignment
  const { data: assignment, error: createError } = await supabase
    .from('assignments')
    .insert({
      matter_id: resolvedMatterId,
      submission_id: resolvedSubmissionId,
      work_item_id: resolvedWorkItemId,
      assigned_by: profile.id,
      assigned_to,
      stage_id: stage_id || null,
      instructions: resolvedInstructions,
      due_date: due_date || null,
      status: 'Assigned',
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Log a system message that the assignment was created, plus the
  // assigner's own comment (if they wrote one) as a separate message so the
  // thread distinguishes "this happened" from "here's what I actually said".
  const messages: { assignment_id: string; sender_id: string; message_type: 'System' | 'Comment'; content: string }[] = [
    {
      assignment_id: assignment.id,
      sender_id: profile.id,
      message_type: 'System',
      content: `Assignment created by ${profile.fullName || 'System'}`,
    },
  ]
  if (message?.trim()) {
    messages.push({
      assignment_id: assignment.id,
      sender_id: profile.id,
      message_type: 'Comment',
      content: message.trim(),
    })
  }
  await supabase.from('assignment_messages').insert(messages)

  // Keep the submission's own "Assigned To" column and event timeline in
  // sync, this is now the one place that assignment happens, the submission
  // list view's Assigned To column reads submissions.assigned_to directly.
  if (resolvedSubmissionId) {
    try {
      await supabase.from('submissions').update({ assigned_to: assigned_to }).eq('id', resolvedSubmissionId)
      await supabase.from('submission_events').insert({
        submission_id: resolvedSubmissionId,
        type: 'assigned',
        detail: `Assigned to ${assignee.full_name}`,
        actor_id: profile.id,
      })
    } catch {
      // Best-effort, the assignment itself already succeeded above.
    }
  }

  return NextResponse.json(assignment, { status: 201 })
}

// GET: List assignments, scoped to what the caller is allowed to see.
// Admin-tier roles (and 'created_by=me'/'assigned_to=me' for anyone) can
// filter freely; anyone else is always constrained to assignments where
// they're the assigner or the assignee, regardless of query params, so a
// pupil can't page through other people's work by guessing IDs.
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  const submissionId = searchParams.get('submission_id')
  const assignedToParam = searchParams.get('assigned_to')
  const createdByParam = searchParams.get('created_by')
  const statusParam = searchParams.get('status')

  const supabase = createAdminClient()
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle()
  const ownTeamMemberId = teamMember?.id ?? null

  // messages included so a step's submitted work is visible wherever this
  // list is consumed, e.g. the intake pipeline stepper. Without it, a
  // 'Submitted' assignment showed only its status badge, the assignee's
  // actual write-up had to be looked up separately on /admin/assignments/[id].
  let query = supabase
    .from('assignments')
    .select('*, assigned_by_user:assigned_by(full_name), assignee:assigned_to(*, profile:profiles(full_name)), messages:assignment_messages(id, sender_id, message_type, content, created_at, sender:profiles(full_name))')

  if (matterId) query = query.eq('matter_id', matterId)
  if (submissionId) query = query.eq('submission_id', submissionId)
  if (statusParam) query = query.in('status', statusParam.split(',').map((s) => s.trim()))

  const assignedToId = assignedToParam === 'me' ? ownTeamMemberId : assignedToParam
  const createdById = createdByParam === 'me' ? profile.id : createdByParam

  if (isAdminRole(profile.role)) {
    if (assignedToId) query = query.eq('assigned_to', assignedToId)
    if (createdById) query = query.eq('assigned_by', createdById)
  } else {
    // Non-privileged caller: ignore anything they asked for beyond their
    // own identity and force the scope, rather than trusting the param.
    if (assignedToParam === 'me' || (!createdByParam && !assignedToParam)) {
      query = ownTeamMemberId ? query.eq('assigned_to', ownTeamMemberId) : query.eq('assigned_to', '00000000-0000-0000-0000-000000000000')
    } else if (createdByParam === 'me') {
      query = query.eq('assigned_by', profile.id)
    } else {
      query = query.or(`assigned_to.eq.${ownTeamMemberId || '00000000-0000-0000-0000-000000000000'},assigned_by.eq.${profile.id}`)
    }
  }

  const { data, error } = await query.order('assigned_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assignments: data })
}
