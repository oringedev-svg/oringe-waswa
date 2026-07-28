'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PublicLayout from '@/components/layout/PublicLayout'
import { Search, CheckCircle, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { formatDate, getStatusColor } from '@/lib/utils'

interface SubmissionUpdate {
  id: string
  status: string
  message: string
  created_at: string
}

interface TrackingResult {
  tracking_code: string
  type: string
  status: string
  submitter_name: string
  created_at: string
  updated_at: string
  updates: SubmissionUpdate[]
}

const statusIcons: Record<string, React.ElementType> = {
  pending: Clock,
  under_review: Search,
  accepted: CheckCircle,
  completed: CheckCircle,
  rejected: XCircle,
  on_hold: AlertCircle,
  interview_scheduled: Clock,
  awaiting_info: AlertCircle,
}

function TrackPageInner() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const params = new URLSearchParams({ code: code.trim().toUpperCase() })
      if (email) params.set('email', email)
      const res = await fetch(`/api/submissions/track?${params}`)
      if (res.ok) {
        setResult(await res.json())
      } else {
        setError('Submission not found. Please check your tracking code.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout>
      <div className="py-20" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container max-w-2xl">
          <span className="eyebrow mb-4 block">Status Tracker</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>
            Track Your Submission
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Enter your tracking code (sent to your email) to view the status and updates on your submission.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container max-w-2xl">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="card p-6 mb-8 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Tracking Code *</label>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="input font-mono tracking-wider"
                  placeholder="e.g. APT-ABC123-XYZ"
                  required
                />
              </div>
              <div>
                <label className="label">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="For verification"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Searching…' : 'Track Submission'}
            </button>
          </form>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 mb-6">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="animate-fade-in">
              {/* Summary Card */}
              <div className="card p-6 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-lg font-bold text-[var(--color-accent)] tracking-widest">{result.tracking_code}</div>
                    <div className="text-sm text-[var(--color-text-muted)] capitalize mt-1">{result.type} Submission</div>
                  </div>
                  <span className={`badge ${getStatusColor(result.status)}`}>
                    {result.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--color-muted)] text-xs uppercase tracking-wider">Submitted By</span>
                    <p className="font-medium text-[var(--color-text-primary)] mt-0.5">{result.submitter_name}</p>
                  </div>
                  <div>
                    <span className="text-[var(--color-muted)] text-xs uppercase tracking-wider">Submitted On</span>
                    <p className="font-medium text-[var(--color-text-primary)] mt-0.5">{formatDate(result.created_at, 'long')}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-4">Status Timeline</h3>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--color-border)]" />
                <div className="flex flex-col gap-4">
                  {result.updates.length === 0 ? (
                    <div className="text-[var(--color-muted)] text-sm pl-12">No updates yet. We'll notify you by email.</div>
                  ) : (
                    result.updates.map((update, i) => {
                      const Icon = statusIcons[update.status] || Clock
                      const isLatest = i === result.updates.length - 1
                      return (
                        <div key={update.id} className="flex gap-4 relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                            isLatest
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-surface-raised)] border-2 border-[var(--color-border)] text-[var(--color-muted)]'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className={`card flex-1 p-4 ${isLatest ? 'border-[var(--color-accent)]' : ''}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`badge ${getStatusColor(update.status)} text-xs`}>
                                {update.status.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-[var(--color-muted)]">{formatDate(update.created_at, 'datetime')}</span>
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{update.message}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackPageInner />
    </Suspense>
  )
}
