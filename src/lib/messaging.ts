import { createAdminClient } from '@/lib/supabase'

// Shared provisioning helpers for the unified messaging engine. Matter
// conversations and practice-area channels are created on first use, not
// through a setup step, so opening a matter or a channel for the first
// time never shows an empty "no conversation yet" dead end.

/** Get-or-create the single conversation for a matter, seeded with every
 * profile currently on matter_people (clients included, per "Every Matter
 * owns its own conversation"). */
export async function getOrCreateMatterConversation(matterId: string, createdBy: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'matter')
    .eq('matter_id', matterId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: matter } = await supabase
    .from('legal_matters')
    .select('id, firm_id, title')
    .eq('id', matterId)
    .single()

  if (!matter) throw new Error('Matter not found')

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      firm_id: matter.firm_id,
      type: 'matter',
      matter_id: matterId,
      title: matter.title,
      created_by: createdBy,
    })
    .select('id')
    .single()

  // Unique index on matter_id may have raced with a concurrent request;
  // fall back to reading the winner rather than surfacing a conflict.
  if (error) {
    const { data: winner } = await supabase
      .from('conversations')
      .select('id')
      .eq('type', 'matter')
      .eq('matter_id', matterId)
      .single()
    if (winner) return winner.id
    throw new Error(error.message)
  }

  const { data: people } = await supabase
    .from('matter_people')
    .select('profile_id')
    .eq('matter_id', matterId)

  const participantIds = new Set([createdBy, ...(people || []).map((p) => p.profile_id)])
  await supabase.from('conversation_participants').insert(
    Array.from(participantIds).map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
      role: profileId === createdBy ? 'admin' : 'member',
    }))
  )

  return conversation.id
}

/** Get-or-create the single channel for a practice area, seeded with every
 * team member currently assigned to it. */
export async function getOrCreatePracticeAreaChannel(practiceAreaId: string, createdBy: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'channel')
    .eq('practice_area_id', practiceAreaId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: practiceArea } = await supabase
    .from('practice_areas')
    .select('id, title')
    .eq('id', practiceAreaId)
    .single()

  if (!practiceArea) throw new Error('Practice area not found')

  const { data: firm } = await supabase.from('firms').select('id').limit(1).maybeSingle()
  if (!firm) throw new Error('No firm found')

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      firm_id: firm.id,
      type: 'channel',
      practice_area_id: practiceAreaId,
      title: practiceArea.title,
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (error) {
    const { data: winner } = await supabase
      .from('conversations')
      .select('id')
      .eq('type', 'channel')
      .eq('practice_area_id', practiceAreaId)
      .single()
    if (winner) return winner.id
    throw new Error(error.message)
  }

  const { data: members } = await supabase
    .from('team_member_practice_areas')
    .select('team_member:team_members(profile_id)')
    .eq('practice_area_id', practiceAreaId)

  const participantIds = new Set<string>([createdBy])
  for (const m of members || []) {
    const profileId = (m.team_member as unknown as { profile_id: string | null })?.profile_id
    if (profileId) participantIds.add(profileId)
  }

  await supabase.from('conversation_participants').insert(
    Array.from(participantIds).map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
      role: profileId === createdBy ? 'admin' : 'member',
    }))
  )

  return conversation.id
}

/** Whether a profile is a participant of a conversation. Every read/write
 * on a conversation must pass through this, "no global inbox" -- a
 * participant list is the only source of who can see a thread. */
export async function isParticipant(conversationId: string, profileId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()
  return !!data
}
