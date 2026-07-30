'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message || 'Something went wrong. Please try again.')
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset password"
      footer={<Link href="/login" className="auth-link">Back to sign in</Link>}
    >
      {sent ? (
        <p className="auth-message">
          If an account exists for {email}, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              autoFocus
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
