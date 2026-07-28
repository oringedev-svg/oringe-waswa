'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, Mail, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const explicitRedirect = searchParams.get('redirect')
  const unauthorized = searchParams.get('error') === 'unauthorized'

  // Clients never see a password field at all, the email step alone
  // decides which form they get. Staff, pupils, and administrative
  // assistants are unaffected; they still sign in with a password.
  const [step, setStep] = useState<'email' | 'password' | 'magic-sent'>('email')
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    setCheckingEmail(true)
    setError('')
    try {
      const res = await fetch('/api/auth/client-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { isClient } = await res.json()
      if (isClient) {
        await sendMagicLink()
      } else {
        setStep('password')
      }
    } finally {
      setCheckingEmail(false)
    }
  }

  async function sendMagicLink() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/portal` },
    })
    setLoading(false)
    if (otpError) {
      setError('Could not send the sign-in link. Please try again.')
      return
    }
    setStep('magic-sent')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError('Incorrect email or password.')
      setLoading(false)
      return
    }

    // Pupils and administrative assistants land on their own desk; everyone
    // else in the full admin panel. (Clients never reach this branch, they
    // sign in passwordlessly, see the magic-link flow above.)
    let destination = explicitRedirect
    if (!destination) {
      const me = await fetch('/api/me').then(r => (r.ok ? r.json() : null)).catch(() => null)
      destination = ['pupil', 'admin_assistant'].includes(me?.role) ? '/desk' : '/admin'
    }

    router.push(destination)
    router.refresh()
  }

  return (
    <AuthLayout title="Oringe Waswa & Akude Advocates LLP" subtitle="Sign in">
      {step === 'magic-sent' ? (
        <div className="auth-form text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            We&apos;ve sent a sign-in link to <strong>{email}</strong>. Open it on this device to access your portal, no password needed.
          </p>
          <button onClick={sendMagicLink} disabled={loading} className="auth-link text-sm mt-4">
            {loading ? 'Sending…' : "Didn't get it? Send again"}
          </button>
        </div>
      ) : step === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="auth-form">
          <div>
            <label className="label">Email</label>
            <input type="email" required disabled className="input opacity-70" value={email} />
            <button type="button" onClick={() => { setStep('email'); setPassword(''); setError('') }} className="auth-link text-xs mt-1">
              Not you? Use a different email
            </button>
          </div>
          <div>
            <div className="auth-field-row">
              <label className="label mb-0">Password</label>
              <a href="/forgot-password" className="auth-link">Forgot password?</a>
            </div>
            <input
              type="password"
              required
              autoFocus
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {(error || unauthorized) && (
            <p className="auth-error">{error || 'Your account does not have admin access.'}</p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleEmailContinue} className="auth-form">
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

          {(error || unauthorized) && (
            <p className="auth-error">{error || 'Your account does not have admin access.'}</p>
          )}

          <button type="submit" disabled={checkingEmail} className="btn btn-primary auth-submit gap-2">
            {checkingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Continue
          </button>
          <p className="text-xs text-[var(--color-muted)] text-center mt-1">
            Clients sign in with an emailed link, no password required.
          </p>
        </form>
      )}
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
