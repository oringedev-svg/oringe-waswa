import { createAdminClient } from '@/lib/supabase'

// Small shared helper. Was inlined identically in two calendar routes as
// a per-attendee loop -- one round-trip to team_members and one to
// profiles for EACH attendee. A meeting with a dozen invitees was firing
// twenty-plus sequential queries where two would do. This resolves a
// whole list of attendees in exactly two queries (one .in() per table)
// and preserves the original attendee row alongside the resolved
// name+email so the caller can still map back to their input.

export interface AttendeeInput {
  team_member_id?: string
  profile_id?: string
  external_name?: string
  external_email?: string
}

export interface ResolvedAttendee<T extends AttendeeInput = AttendeeInput> {
  name: string
  email: string
  row: T
}

export async function resolveAttendees<T extends AttendeeInput>(attendees: T[]): Promise<ResolvedAttendee<T>[]> {
  if (attendees.length === 0) return []
  const supabase = createAdminClient()

  const teamIds = Array.from(new Set(attendees.map((a) => a.team_member_id).filter((v): v is string => !!v)))
  const profileIds = Array.from(new Set(attendees.map((a) => a.profile_id).filter((v): v is string => !!v)))

  const [teamRes, profileRes] = await Promise.all([
    teamIds.length
      ? supabase.from('team_members').select('id, full_name, email').in('id', teamIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
    profileIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
  ])
  const teamById = new Map((teamRes.data || []).map((m) => [m.id, m]))
  const profileById = new Map((profileRes.data || []).map((p) => [p.id, p]))

  const resolved: ResolvedAttendee<T>[] = []
  for (const a of attendees) {
    if (a.team_member_id) {
      const m = teamById.get(a.team_member_id)
      if (m?.email) resolved.push({ name: m.full_name, email: m.email, row: a })
    } else if (a.profile_id) {
      const p = profileById.get(a.profile_id)
      if (p?.email) resolved.push({ name: p.full_name, email: p.email, row: a })
    } else if (a.external_email) {
      resolved.push({ name: a.external_name || a.external_email, email: a.external_email, row: a })
    }
  }
  return resolved
}
