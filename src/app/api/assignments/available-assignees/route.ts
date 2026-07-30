import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

// Fetch team members available for assignment on a specific matter.
// Team members who are clients on that matter appear but marked ineligible.
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')

  const supabase = createAdminClient()

  // Fetch all active team members with their linked profiles
  const { data: teamMembers, error: tmError } = await supabase
    .from('team_members')
    .select('id, profile_id, full_name, position, is_active, profile:profiles(id)')
    .eq('is_active', true)

  if (tmError) {
    return NextResponse.json({ error: tmError.message }, { status: 500 })
  }

  // Without a matter (a submission that hasn't been promoted yet), there's
  // no matter_people to check against, so no client-blocking concept
  // applies, every active team member is eligible.
  let clientProfileIds = new Set<string>()
  if (matterId) {
    const { data: matterPeople, error: mpError } = await supabase
      .from('matter_people')
      .select('profile_id, role')
      .eq('matter_id', matterId)

    if (mpError) {
      return NextResponse.json({ error: mpError.message }, { status: 500 })
    }

    // Build a set of profile IDs who are clients on this matter
    clientProfileIds = new Set(
      (matterPeople || [])
        .filter(mp => mp.role === 'client')
        .map(mp => mp.profile_id)
    )
  }

  // Enrich team members with eligibility status
  // Use profile_id if available, otherwise use the linked profile.id
  const assignees = (teamMembers || [])
    .filter(tm => tm.profile_id || tm.profile) // Only include if linked to a profile
    .map(tm => {
      const profileId = tm.profile_id || (tm.profile as any)?.id
      return {
        id: tm.id,
        full_name: tm.full_name,
        position: tm.position,
        is_eligible: !clientProfileIds.has(profileId),
        ineligible_reason: clientProfileIds.has(profileId)
          ? 'This person is a client on this matter and cannot be assigned work'
          : null,
      }
    })

  return NextResponse.json({ assignees })
}
