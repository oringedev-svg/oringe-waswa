import { NextRequest, NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { sendPushToProfile, sendPushToProfiles } from '@/lib/webPush'

// Sending to yourself (no profile_id/profile_ids given) needs nothing
// beyond being signed in -- it's how the "Enable notifications" control
// confirms a subscription actually works. Sending to anyone else is
// gated: sending push notifications is a real interruption on someone
// else's phone, not something any signed-in caller should be able to
// trigger for another person.
export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json()
  const { title, body: message, url, profile_id, profile_ids } = body

  if (!title || !message) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const targets: string[] = profile_ids && Array.isArray(profile_ids) ? profile_ids : profile_id ? [profile_id] : [profile.id]
  const isSelfOnly = targets.length === 1 && targets[0] === profile.id

  if (!isSelfOnly) {
    const canSend = profile.role === 'admin' || (await userHasPermission(profile.userId, profile.role, 'send_push_notifications'))
    if (!canSend) {
      return NextResponse.json({ error: 'You do not have permission to send push notifications to other people' }, { status: 403 })
    }
  }

  try {
    const result =
      targets.length === 1
        ? await sendPushToProfile(targets[0], { title, body: message, url })
        : await sendPushToProfiles(targets, { title, body: message, url })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not send notification' }, { status: 500 })
  }
}
