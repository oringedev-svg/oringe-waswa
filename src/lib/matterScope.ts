import { createAdminClient } from './supabase'
import { userHasPermission } from './permissions'
import type { SessionProfile } from './auth'

export type MatterScope = { all: true } | { all: false; matterIds: string[] }

/**
 * Which matters a signed-in user may see.
 *
 * admin always gets everything. Anyone holding 'manage_matters' (staff's
 * role default, or an explicit /admin/users grant) also gets everything,
 * same as today. Everyone else, pupils and admin assistants by default,
 * only sees matters they're personally tied to: a matter_people entry, or
 * the assignee on an assignment for that matter. That is the gap that let
 * a pupil browse the entire firm's docket, closed here rather than by
 * blocking pupils from matters entirely, since the assignment workflow
 * depends on them reaching their own matter.
 */
export async function getMatterAccessScope(profile: SessionProfile): Promise<MatterScope> {
  if (profile.role === 'admin') return { all: true }

  const hasManageMatters = await userHasPermission(profile.userId, profile.role, 'manage_matters')
  if (hasManageMatters) return { all: true }

  const supabase = createAdminClient()
  const [{ data: peopleLinks }, { data: teamMember }] = await Promise.all([
    supabase.from('matter_people').select('matter_id').eq('profile_id', profile.id),
    supabase.from('team_members').select('id').eq('profile_id', profile.id).maybeSingle(),
  ])

  let assignedMatterIds: string[] = []
  if (teamMember) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('matter_id')
      .eq('assigned_to', teamMember.id)
    // Assignments can be submission-only (no matter yet), matter_id is null
    assignedMatterIds = (assignments || []).map((a) => a.matter_id).filter((id): id is string => !!id)
  }

  const matterIds = Array.from(
    new Set([...(peopleLinks || []).map((p) => p.matter_id), ...assignedMatterIds])
  )

  return { all: false, matterIds }
}

export function canAccessMatter(scope: MatterScope, matterId: string): boolean {
  return scope.all || scope.matterIds.includes(matterId)
}
