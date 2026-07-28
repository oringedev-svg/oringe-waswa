'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PublicLayout from '@/components/layout/PublicLayout'
import { CheckCircle, Loader2 } from 'lucide-react'

function UnsubscribePageInner() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function unsubscribe() {
    if (!email) return
    setLoading(true)
    await fetch(`/api/mail/subscribers?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
    setDone(true)
    setLoading(false)
  }

  return (
    <PublicLayout>
      <div className="section">
        <div className="container max-w-md text-center">
          {done ? (
            <div className="card p-10">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h1 className="font-display text-2xl font-semibold mb-2">Unsubscribed</h1>
              <p className="text-[var(--color-text-muted)]">You've been removed from our mailing list.</p>
            </div>
          ) : (
            <div className="card p-10">
              <h1 className="font-display text-2xl font-semibold mb-2">Unsubscribe</h1>
              <p className="text-[var(--color-text-muted)] mb-6">
                Unsubscribe <strong>{email}</strong> from the Oringe Waswa & Akude Advocates LLP newsletter?
              </p>
              <button onClick={unsubscribe} disabled={loading} className="btn btn-primary gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm Unsubscribe
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribePageInner />
    </Suspense>
  )
}
