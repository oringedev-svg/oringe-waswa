import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { isParticipant } from '@/lib/messaging'

// POST: Mark a conversation read up to now. Unread state lives on
// conversation_participants.last_read_at rather than a per-message row,
// the same approach used by every chat product this pattern is modeled on.
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

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .eq('profile_id', profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
