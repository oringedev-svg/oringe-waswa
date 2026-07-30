import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile } from '@/lib/auth'

// POST: Reassign work after rejection or revocation
// Can be used to:
// • Return to original assignee (return_to_assignee: true)
// • Assign to a different person (assign_to: <team_member_id>)
// • Claim the assignment themselves (claim: true)
// • Cancel the assignment (cancel: true)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { return_to_assignee, assign_to, claim, cancel, message } = await req.json()

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

  // Can only reassign after rejection or revocation
  if (!['Rejected', 'Revoked'].includes(assignment.status)) {
    return NextResponse.json(
      { error: `Cannot reassign assignment in ${assignment.status} status` },
      { status: 400 }
    )
  }

  // Only the original assigner can make reassignment decisions
  if (assignment.assigned_by !== profile.id) {
    return NextResponse.json(
      { error: 'Only the original assigner can make reassignment decisions' },
      { status: 403 }
    )
  }

  let newAssignedTo = null
  let newStatus = 'Cancelled'
  let systemMessage = ''

  if (cancel) {
    newStatus = 'Cancelled'
    systemMessage = `${profile.fullName} cancelled this assignment`
  } else if (return_to_assignee) {
    newAssignedTo = assignment.assigned_to
    newStatus = 'Assigned'
    systemMessage = `${profile.fullName} returned this assignment to the original assignee`
  } else if (claim) {
    // Verify the assigner is in team_members
    const { data: claimer } = await supabase
      .from('team_members')
      .select('id')
      .eq('profile_id', profile.id)
      .single()

    if (!claimer) {
      return NextResponse.json(
        { error: 'You are not registered as a team member and cannot claim assignments' },
        { status: 400 }
      )
    }

    newAssignedTo = claimer.id
    newStatus = 'Assigned'
    systemMessage = `${profile.fullName} claimed this assignment`
  } else if (assign_to) {
    // Verify assignee is valid and active
    const { data: newAssignee, error: assigneeError } = await supabase
      .from('team_members')
      .select('id, profile_id')
      .eq('id', assign_to)
      .eq('is_active', true)
      .single()

    if (assigneeError || !newAssignee) {
      return NextResponse.json({ error: 'New assignee not found or inactive' }, { status: 404 })
    }

    // Check if new assignee is a client on this matter
    const { data: clientLink } = await supabase
      .from('matter_people')
      .select('id')
      .eq('matter_id', assignment.matter_id)
      .eq('profile_id', newAssignee.profile_id)
      .eq('role', 'client')
      .single()

    if (clientLink) {
      return NextResponse.json(
        { error: 'Cannot assign to someone who is a client on this matter' },
        { status: 400 }
      )
    }

    newAssignedTo = assign_to
    newStatus = 'Assigned'
    systemMessage = `${profile.fullName} reassigned this work to a new team member`
  } else {
    return NextResponse.json(
      { error: 'Must specify one of: cancel, return_to_assignee, claim, or assign_to' },
      { status: 400 }
    )
  }

  // Update the assignment
  const { data: updated, error: updateError } = await supabase
    .from('assignments')
    .update({
      status: newStatus,
      assigned_to: newAssignedTo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log messages
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
      message_type: 'Decision',
      content: message,
    })
  }

  await supabase.from('assignment_messages').insert(messages)

  return NextResponse.json(updated)
}
