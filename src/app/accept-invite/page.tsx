'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

export default function AcceptInvitePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    let established = false

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        established = true
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        established = true
        setReady(true)
      }
    })

    const timeout = setTimeout(() => {
      if (!established) setInvalid(true)
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
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
      setError('Could not set password. Ask for a new invitation link.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <AuthLayout title="Activate your account" subtitle="Set a password to finish setting up access.">
      {invalid && !ready ? (
        <p className="auth-message">
          This invitation link is invalid or has expired. Ask an administrator to resend it.
        </p>
      ) : !ready ? (
        <div className="auth-loading">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="label">Password</label>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set password and continue'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
