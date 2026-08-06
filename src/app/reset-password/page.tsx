'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Present when arriving from a recovery email. /auth/callback deliberately
  // forwards the code here unspent instead of exchanging it itself, so that a
  // mail scanner merely fetching the link can't burn it -- see the note in
  // src/app/auth/callback/route.ts. It gets spent on submit, below.
  const recoveryCode = searchParams.get('code')

  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Holding a recovery code is enough to show the form. Rendering a form is
    // not "using" the link, so nothing is consumed here.
    if (recoveryCode) {
      setReady(true)
      setInvalid(false)
      return
    }

    const supabase = createClient()
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (active) { setReady(true); setInvalid(false) }
      }
    })

    // Invite links (portal and staff account invites) and any already-
    // established recovery session arrive here with a live session and no
    // code, which is still a legitimate way to reach this page.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (active) { setReady(true); setInvalid(false) }
      } else if (active) {
        setInvalid(true)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [recoveryCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    // Spend the single-use code at the one moment we know a human is here.
    if (recoveryCode) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recoveryCode)
      if (exchangeError) {
        setLoading(false)
        // PKCE ties the code to the browser that requested it, so "opened in
        // a different browser" is a real and easily-hit cause here, not just
        // expiry. Naming all three saves a pointless second attempt.
        setError(
          'This reset link could not be verified. It may have expired, already been used, or been opened in a different browser than the one that requested it. Request a new link from the sign-in page.'
        )
        return
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (updateError) {
      // A blanket "link expired" message here was actively misleading: the
      // recovery session at this point is already valid, so a failure is
      // almost always the password itself -- too weak for the project's
      // policy, or identical to the current one, both of which Supabase
      // reports in updateError.message. Only an actual session/auth failure
      // should point the user back to requesting a new link.
      const isSessionError = /session|token|jwt|expired|unauthorized/i.test(updateError.message)
      setError(
        isSessionError
          ? 'Your session has expired. Request a new reset link.'
          : updateError.message
      )
      return
    }

    // This page also serves portal invites and staff account invites, each
    // role lands where it belongs, not always the admin panel.
    const me = await fetch('/api/me').then(r => (r.ok ? r.json() : null)).catch(() => null)
    const dest = me?.role === 'client' ? '/portal' : ['pupil', 'admin_assistant'].includes(me?.role) ? '/desk' : '/admin'
    router.replace(dest)
    router.refresh()
  }

  return (
    <AuthLayout title="Set new password">
      {invalid && !ready ? (
        <p className="auth-message">
          This link is invalid or has expired. Request a new one from the sign-in page.
        </p>
      ) : !ready ? (
        <div className="auth-loading">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              required
              autoFocus
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              required
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Set new password">
          <div className="auth-loading"><Loader2 className="animate-spin" /></div>
        </AuthLayout>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}
