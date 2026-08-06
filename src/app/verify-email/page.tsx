'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PublicLayout from '@/components/layout/PublicLayout'
import { CheckCircle, XCircle, Loader2, MailCheck } from 'lucide-react'

type ViewState = 'ready' | 'confirming' | 'confirmed' | 'error'

// Deliberately NOT auto-confirmed on page load. Corporate email security
// scanners (Microsoft Defender Safe Links, Google's link-checker, etc.)
// pre-fetch every URL in an incoming email to scan it for malware, which
// would burn a token before the actual recipient ever opened their inbox.
// Requiring a real click keeps that from happening -- scanners don't click
// buttons.
function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [state, setState] = useState<ViewState>('ready')
  const [message, setMessage] = useState('')
  const [trackingCode, setTrackingCode] = useState<string | null>(null)

  async function confirm() {
    if (!token) return
    setState('confirming')
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        setState('confirmed')
        if (body.trackingCode) setTrackingCode(body.trackingCode)
      } else {
        setState('error')
        setMessage(body.message || 'This confirmation link is not valid.')
      }
    } catch {
      setState('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      {!token ? (
        <>
          <XCircle className="w-12 h-12 text-[var(--status-overdue)] mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Missing confirmation link</h1>
          <p className="text-[var(--color-text-muted)]">This page needs the link from your confirmation email to work.</p>
        </>
      ) : state === 'ready' || state === 'confirming' ? (
        <>
          <MailCheck className="w-12 h-12 text-[var(--color-accent)] mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Confirm your email</h1>
          <p className="text-[var(--color-text-muted)] mb-6">One click and we'll know this submission is really from you.</p>
          <button onClick={confirm} disabled={state === 'confirming'} className="btn btn-primary gap-2">
            {state === 'confirming' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {state === 'confirming' ? 'Confirming…' : 'Confirm my email'}
          </button>
        </>
      ) : state === 'confirmed' ? (
        <>
          <CheckCircle className="w-12 h-12 text-[var(--status-active)] mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Email confirmed</h1>
          <p className="text-[var(--color-text-muted)]">
            {trackingCode
              ? <>Thank you — we've received your submission. Your tracking code is <strong className="text-[var(--color-text-primary)]">{trackingCode}</strong>.</>
              : "Thank you — we've received it and will be in touch."}
          </p>
        </>
      ) : (
        <>
          <XCircle className="w-12 h-12 text-[var(--status-overdue)] mx-auto mb-4" />
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Couldn't confirm</h1>
          <p className="text-[var(--color-text-muted)]">{message}</p>
        </>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="py-24 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--color-accent)]" /></div>}>
        <VerifyEmailInner />
      </Suspense>
    </PublicLayout>
  )
}
