import { NextRequest, NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { getOrCreateMatterConversation, isParticipant } from '@/lib/messaging'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'

// GET: Get-or-create the matter's conversation, so opening a matter for
// the first time never shows an empty "no conversation yet" dead end (per
// "The assignment is the workspace" -- a Matter always knows its own
// discussion thread).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matterId: string }> }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { matterId } = await params

  // Auto-join-on-open only makes sense for someone who is already allowed
  // on this matter, guessing a matter_id must never be a backdoor into its
  // conversation (matter scoping requirement, see matterScope.ts).
  const scope = await getMatterAccessScope(profile)
  if (!canAccessMatter(scope, matterId)) {
    return NextResponse.json({ error: 'Not authorized for this matter' }, { status: 403 })
  }

  const supabase = createAdminClient()

  try {
    const conversationId = await getOrCreateMatterConversation(matterId, profile.id)

    // Provisioning above adds current matter_people as participants, but a
    // caller who was added to the matter after the conversation already
    // existed (or a staff member who isn't on matter_people at all, e.g. an
    // admin) still needs a seat before they can read or post here.
    if (!(await isParticipant(conversationId, profile.id))) {
      await supabase
        .from('conversation_participants')
        .insert({ conversation_id: conversationId, profile_id: profile.id, role: 'member' })
        .select()
        .maybeSingle()
    }

    const { data: conversation } = await supabase.from('conversations').select('*').eq('id', conversationId).single()

    return NextResponse.json(conversation)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not open matter conversation' },
      { status: 500 }
    )
  }
}
