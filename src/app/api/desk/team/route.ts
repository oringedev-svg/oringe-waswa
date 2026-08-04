import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Who counts as "my team".
//
// Pupils are one team regardless of practice area: a pupil rotates across
// whatever work the firm has on, so grouping them by practice area would
// put two people doing identical work in different teams. Everyone else is
// grouped by the practice areas they're actually assigned to, which is the
// same grouping the messaging channels and scoped permissions already use.
//
// Anyone with no practice area on record falls back to their colleagues at
// the same seniority. That isn't a real team so much as an honest answer to
// "who is like me" when the taxonomy hasn't been filled in -- most of this
// firm's team_members have no practice-area link yet, and showing an empty
// page to nine of twelve people would be worse.
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: me } = await supabase
    .from('team_members')
    .select('id, full_name, position, seniority, avatar_url, profile_id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (!me) {
    return NextResponse.json({ teamMember: null, teams: [] })
  }

  const isPupil = (me.seniority || '').toLowerCase() === 'pupil'

  const [{ data: allMembers }, { data: allLinks }] = await Promise.all([
    supabase
      .from('team_members')
      .select('id, full_name, position, seniority, avatar_url, profile_id')
      .eq('is_active', true),
    supabase
      .from('team_member_practice_areas')
      .select('team_member_id, practice_area_id, practice_area:practice_areas(id, title)'),
  ])

  const members = allMembers || []
  const links = (allLinks || []) as unknown as {
    team_member_id: string
    practice_area_id: string
    practice_area: { id: string; title: string } | null
  }[]

  // Open work per person, so a team page answers "who is loaded" and not
  // just "who exists".
  const { data: openWork } = await supabase
    .from('assignments')
    .select('assigned_to')
    .in('status', ['Assigned', 'Accepted', 'In Progress'])

  const loadByMember = new Map<string, number>()
  for (const row of openWork || []) {
    if (!row.assigned_to) continue
    loadByMember.set(row.assigned_to, (loadByMember.get(row.assigned_to) || 0) + 1)
  }

  const shape = (m: (typeof members)[number]) => ({
    id: m.id,
    full_name: m.full_name,
    position: m.position,
    seniority: m.seniority,
    avatar_url: m.avatar_url,
    open_work: loadByMember.get(m.id) || 0,
    is_me: m.id === me.id,
  })

  const teams: { key: string; label: string; basis: string; members: ReturnType<typeof shape>[] }[] = []

  if (isPupil) {
    const pupils = members.filter((m) => (m.seniority || '').toLowerCase() === 'pupil')
    teams.push({
      key: 'pupils',
      label: 'Pupils',
      basis: 'Pupils work across every practice area, so you are all one team.',
      members: pupils.map(shape),
    })
  } else {
    const myAreaIds = links.filter((l) => l.team_member_id === me.id).map((l) => l.practice_area_id)

    for (const areaId of Array.from(new Set(myAreaIds))) {
      const title = links.find((l) => l.practice_area_id === areaId)?.practice_area?.title || 'Practice area'
      const memberIds = new Set(links.filter((l) => l.practice_area_id === areaId).map((l) => l.team_member_id))
      teams.push({
        key: `area:${areaId}`,
        label: title,
        basis: 'Everyone assigned to this practice area.',
        members: members.filter((m) => memberIds.has(m.id)).map(shape),
      })
    }

    if (teams.length === 0) {
      const peers = members.filter(
        (m) => (m.seniority || '').toLowerCase() === (me.seniority || '').toLowerCase()
      )
      teams.push({
        key: 'seniority',
        label: 'Colleagues',
        basis: 'You have no practice area on record yet, so this is everyone at your level. Ask an administrator to add your practice areas from Team.',
        members: peers.map(shape),
      })
    }
  }

  return NextResponse.json({ teamMember: shape(me), teams })
}
