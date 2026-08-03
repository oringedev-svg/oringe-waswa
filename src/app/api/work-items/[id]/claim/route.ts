import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Claim is intentionally a conditional write. A concurrent caller can read
// the same queue row, but only the update that still sees queued/unassigned
// succeeds; the loser receives a recorded denial instead of double ownership.
export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('claim_work')
  if ('response' in guard) return guard.response
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: member } = await supabase.from('team_members').select('id').eq('profile_id', profile.id).eq('is_active', true).maybeSingle()
  if (!member) return NextResponse.json({ error: 'An active team-member record is required to claim work' }, { status: 403 })

  const { data: claimed, error: claimError } = await supabase.rpc('claim_work_item', {
    p_work_item_id: params.id,
    p_claimant_profile_id: profile.id,
  })
  const item = Array.isArray(claimed) ? claimed[0] : claimed

  if (claimError || !item) {
    const reason = claimError?.code === '55P03'
      ? 'Claim is being processed by another user'
      : 'Already claimed, unavailable, or no longer queued'
    await supabase.from('work_item_claims').insert({ work_item_id: params.id, claimant_profile_id: profile.id, claimant_team_member_id: member.id, status: 'DENIED', reason })
    return NextResponse.json({ error: 'This work item is no longer available to claim' }, { status: 409 })
  }

  await supabase.from('work_item_claims').insert({ work_item_id: item.id, claimant_profile_id: profile.id, claimant_team_member_id: member.id, status: 'GRANTED' })

  // `assignments` remains the review/handover record. The queue item is the
  // activity instance; claiming it creates its one accountable execution.
  const { data: assignment, error: assignmentError } = await supabase.from('assignments').insert({
    matter_id: item.matter_id,
    submission_id: item.submission_id,
    work_item_id: item.id,
    assigned_by: profile.id,
    assigned_to: member.id,
    instructions: item.instructions || item.title,
    due_date: item.due_at ? item.due_at.slice(0, 10) : null,
    status: 'Accepted',
  }).select().single()

  if (assignmentError) {
    // Release only the claim we just won. The immutable granted claim remains
    // an audit fact and the item becomes available again for recovery.
    await supabase.from('work_items').update({ assigned_to_profile_id: null, status: 'queued', updated_at: new Date().toISOString() }).eq('id', item.id).eq('assigned_to_profile_id', profile.id)
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  await supabase.from('assignment_ownership_history').insert({ assignment_id: assignment.id, to_team_member_id: member.id, changed_by: profile.id, reason: 'Claimed from work queue' })
  await logAudit({ table_name: 'work_items', record_id: item.id, action: 'UPDATE', new_data: { claim: 'granted', assignment_id: assignment.id } })
  return NextResponse.json({ work_item: item, assignment }, { status: 201 })
}
