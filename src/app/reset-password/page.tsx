'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (active) { setReady(true); setInvalid(false) }
      }
    })

    // Covers the case where the recovery session was already established
    // (link processed) before this listener was attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (active) { setReady(true); setInvalid(false) }
      } else if (active) {
        // The callback route has already exchanged a valid PKCE recovery
        // code by this point. A missing session is therefore a real invalid
        // or expired link, not a race hidden behind an arbitrary timeout.
        setInvalid(true)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

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
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (updateError) {
      setError('Could not update password. Try requesting a new reset link.')
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
