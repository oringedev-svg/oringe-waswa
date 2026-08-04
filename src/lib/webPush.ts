import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase'

let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT)')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

/**
 * Sends a push notification to every device a profile has subscribed on.
 * A subscription the push service reports as gone (410) or not found (404)
 * is deleted here rather than left to fail the same way forever -- the
 * browser discarded it, there is nothing left to retry.
 */
export async function sendPushToProfile(profileId: string, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  ensureConfigured()
  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId)

  if (!subs || subs.length === 0) return { sent: 0, removed: 0 }

  let sent = 0
  let removed = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        sent++
        await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id)
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          removed++
        } else {
          console.warn('[push] send failed:', err instanceof Error ? err.message : err)
        }
      }
    })
  )

  return { sent, removed }
}

/** Same as sendPushToProfile, for more than one recipient at once. */
export async function sendPushToProfiles(profileIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  const results = await Promise.all(profileIds.map((id) => sendPushToProfile(id, payload)))
  return results.reduce((acc, r) => ({ sent: acc.sent + r.sent, removed: acc.removed + r.removed }), { sent: 0, removed: 0 })
}
