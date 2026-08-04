import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { getOrCreatePracticeAreaChannel } from '@/lib/messaging'

// GET: List conversations the caller participates in. Message ownership
// rule (no global inbox): a conversation is visible only through
// conversation_participants, never by type or firm alone.
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  let query = supabase
    .from('conversation_participants')
    .select(
      `last_read_at,
       conversation:conversations(
         id, type, title, matter_id, practice_area_id, last_message_at, created_at,
         matter:legal_matters(matter_number, title),
         practice_area:practice_areas(title),
         participants:conversation_participants(profile_id, profile:profiles(full_name, avatar_url))
       )`
    )
    .eq('profile_id', profile.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let conversations = ((data || []) as unknown as { last_read_at: string | null; conversation: any }[])
    .map((row) => ({ ...row.conversation, last_read_at: row.last_read_at }))
    .filter((c) => c && (!type || c.type === type))

  // Unread count and preview require the latest message per conversation;
  // fetched separately rather than joined, an aggregate join here would
  // silently drop conversations with zero messages.
  const conversationIds = conversations.map((c: any) => c.id)
  if (conversationIds.length > 0) {
    const { data: latestMessages } = await supabase
      .from('messages')
      .select('id, conversation_id, content, created_at, actual_sender_id, display_sender_id')
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const latestByConversation = new Map<string, any>()
    for (const m of latestMessages || []) {
      if (!latestByConversation.has(m.conversation_id)) latestByConversation.set(m.conversation_id, m)
    }

    const { data: unreadCounts } = await supabase
      .from('messages')
      .select('conversation_id, created_at')
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)

    conversations = conversations.map((c: any) => {
      const lastMessage = latestByConversation.get(c.id) || null
      const unread = (unreadCounts || []).filter(
        (m) => m.conversation_id === c.id && (!c.last_read_at || new Date(m.created_at) > new Date(c.last_read_at))
      ).length
      return { ...c, last_message: lastMessage, unread_count: unread }
    })
  }

  conversations.sort((a: any, b: any) => {
    const at = a.last_message_at || a.created_at
    const bt = b.last_message_at || b.created_at
    return new Date(bt).getTime() - new Date(at).getTime()
  })

  return NextResponse.json({ conversations })
}

// POST: Create a conversation. 'direct'/'group' need participant_ids;
// 'channel' is get-or-created from practice_area_id (never duplicated,
// see the unique index on conversations.practice_area_id).
export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json()
  const { type, title, participant_ids, practice_area_id } = body

  if (!type || !['direct', 'group', 'channel'].includes(type)) {
    return NextResponse.json({ error: 'type must be direct, group, or channel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (type === 'channel') {
    if (!practice_area_id) {
      return NextResponse.json({ error: 'practice_area_id is required for a channel' }, { status: 400 })
    }
    try {
      const conversationId = await getOrCreatePracticeAreaChannel(practice_area_id, profile.id)
      const { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      return NextResponse.json(conversation, { status: 201 })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create channel' }, { status: 500 })
    }
  }

  if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
    return NextResponse.json({ error: 'participant_ids is required' }, { status: 400 })
  }

  if (type === 'direct' && participant_ids.length !== 1) {
    return NextResponse.json({ error: 'A direct conversation needs exactly one other participant' }, { status: 400 })
  }

  const allParticipantIds = Array.from(new Set([profile.id, ...participant_ids]))

  // Reuse an existing direct conversation between the same two people
  // instead of spawning a duplicate every time "message X" is clicked.
  if (type === 'direct') {
    const { data: mine } = await supabase
      .from('conversation_participants')
      .select('conversation_id, conversation:conversations(type)')
      .eq('profile_id', profile.id)

    for (const row of mine || []) {
      if ((row.conversation as any)?.type !== 'direct') continue
      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('profile_id')
        .eq('conversation_id', row.conversation_id)
      const ids = new Set((otherParticipants || []).map((p) => p.profile_id))
      if (ids.size === allParticipantIds.length && allParticipantIds.every((id) => ids.has(id))) {
        const { data: existing } = await supabase.from('conversations').select('*').eq('id', row.conversation_id).single()
        return NextResponse.json(existing, { status: 200 })
      }
    }
  }

  const { data: firm } = await supabase.from('firms').select('id').limit(1).maybeSingle()
  if (!firm) return NextResponse.json({ error: 'No firm found' }, { status: 404 })

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      firm_id: firm.id,
      type,
      title: title || null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('conversation_participants').insert(
    allParticipantIds.map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
      role: profileId === profile.id ? 'admin' : 'member',
    }))
  )

  return NextResponse.json(conversation, { status: 201 })
}
