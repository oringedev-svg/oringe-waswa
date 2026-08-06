'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'

// A VAPID public key is delivered base64url-encoded; the Push API wants it
// as a raw byte array for applicationServerKey.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const bytes = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes
}

type PushState = 'unsupported' | 'default' | 'subscribed' | 'denied' | 'loading'

interface PushNotificationBellProps {
  /**
   * 'band' reads the --on-band-* tokens, for AdminLayout's coloured top bar.
   * 'surface' reads the plain --color-* tokens, for a header sitting directly
   * on the page surface -- /desk, the pupil and admin-assistant workspace,
   * which hand-rolls its own header instead of rendering AdminLayout.
   */
  tone?: 'band' | 'surface'
}

export default function PushNotificationBell({ tone = 'band' }: PushNotificationBellProps) {
  const [state, setState] = useState<PushState>('default')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready.then(async (registration) => {
      const existing = await registration.pushManager.getSubscription()
      setState(existing ? 'subscribed' : 'default')
    })
  }, [])

  async function enable() {
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default')
        if (permission === 'denied') toast.error('Notifications blocked. Enable them in your browser settings to turn this on.')
        return
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        toast.error('Push notifications are not configured on this deployment yet.')
        setState('default')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS's DOM lib types applicationServerKey against ArrayBuffer
        // specifically, excluding the SharedArrayBuffer-inclusive
        // ArrayBufferLike a plain `new Uint8Array(...)` carries -- a real
        // BufferSource at runtime, just a stricter type than the lib
        // expects.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!res.ok) throw new Error('Could not save subscription')
      setState('subscribed')
      toast.success('Notifications enabled on this device')
    } catch {
      setState('default')
      toast.error('Could not enable notifications')
    }
  }

  async function disable() {
    setState('loading')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState('default')
      toast.success('Notifications turned off on this device')
    } catch {
      setState('subscribed')
      toast.error('Could not turn off notifications')
    }
  }

  if (state === 'unsupported') return null

  const baseClass = tone === 'surface'
    ? 'inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] transition-colors relative'
    : 'inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors relative'

  if (state === 'subscribed') {
    return (
      <button onClick={disable} aria-label="Notifications on — turn off" className={baseClass} title="Notifications on for this device — click to turn off">
        <BellRing className="w-4 h-4" />
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </button>
    )
  }

  if (state === 'denied') {
    return (
      <button
        onClick={() => toast.error('Notifications are blocked for this site. Enable them in your browser settings.')}
        aria-label="Notifications blocked"
        className={baseClass}
        title="Notifications blocked — check your browser settings"
      >
        <BellOff className="w-4 h-4" />
      </button>
    )
  }

  return (
    <button onClick={enable} disabled={state === 'loading'} aria-label="Turn on notifications" className={baseClass} title="Turn on notifications for this device">
      <Bell className="w-4 h-4" />
    </button>
  )
}
