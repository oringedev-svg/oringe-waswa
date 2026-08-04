import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { isParticipant } from '@/lib/messaging'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  if (!(await isParticipant(id, profile.id))) {
    return NextResponse.json({ error: 'Not a participant of this conversation' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = supabase
    .from('messages')
    .select(
      `id, content, message_type, mentions, attachments, reply_to_id, edited_at, deleted_at, created_at,
       actual_sender:actual_sender_id(id, full_name, avatar_url),
       display_sender:display_sender_id(id, full_name, avatar_url),
       reactions:message_reactions(id, profile_id, emoji)`
    )
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: (data || []).reverse() })
}

// POST: Post a message. actual_sender_id is always the authenticated
// caller, never taken from the request body, identity cannot be spoofed.
// display_sender_id (delegated send) requires the 'send_on_behalf'
// permission plus a delegation_approved_by already on record for the
// caller to cite; the write refuses to proceed without both.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  if (!(await isParticipant(id, profile.id))) {
    return NextResponse.json({ error: 'Not a participant of this conversation' }, { status: 403 })
  }

  const body = await req.json()
  const { content, reply_to_id, mentions, attachments, display_sender_id, delegation_approved_by } = body

  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let resolvedDisplaySenderId: string | null = null
  let resolvedDelegationApprovedBy: string | null = null
  let resolvedDelegationApprovedAt: string | null = null

  if (display_sender_id && display_sender_id !== profile.id) {
    const canDelegate = await userHasPermission(profile.userId, profile.role, 'send_on_behalf')
    if (!canDelegate) {
      return NextResponse.json(
        { error: 'You do not have permission to send on behalf of another team member' },
        { status: 403 }
      )
    }
    if (!delegation_approved_by) {
      return NextResponse.json(
        { error: 'delegation_approved_by is required to send under another identity' },
        { status: 400 }
      )
    }
    resolvedDisplaySenderId = display_sender_id
    resolvedDelegationApprovedBy = delegation_approved_by
    resolvedDelegationApprovedAt = new Date().toISOString()
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      actual_sender_id: profile.id,
      display_sender_id: resolvedDisplaySenderId,
      delegation_approved_by: resolvedDelegationApprovedBy,
      delegation_approved_at: resolvedDelegationApprovedAt,
      reply_to_id: reply_to_id || null,
      content: content.trim(),
      mentions: Array.isArray(mentions) ? mentions : [],
      attachments: Array.isArray(attachments) ? attachments : [],
    })
    .select(
      `id, content, message_type, mentions, attachments, reply_to_id, created_at,
       actual_sender:actual_sender_id(id, full_name, avatar_url),
       display_sender:display_sender_id(id, full_name, avatar_url)`
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('conversations').update({ last_message_at: message.created_at }).eq('id', id)

  // Sending implicitly marks the sender's own copy read, otherwise their
  // own message would immediately count against their unread badge.
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: message.created_at })
    .eq('conversation_id', id)
    .eq('profile_id', profile.id)

  return NextResponse.json(message, { status: 201 })
}
