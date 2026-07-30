'use client'
import { useState } from 'react'
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, StatusPill, type Tone } from '@/components/admin/ui'

interface ConflictMatch { match_type: string; name: string; detail: string; risk: 'low' | 'medium' | 'high' }

const RISK_TONE: Record<string, Tone> = {
  high: 'overdue',
  medium: 'risk',
  low: 'review',
}

export default function ConflictCheckPage() {
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [ranFor, setRanFor] = useState('')
  const [results, setResults] = useState<ConflictMatch[]>([])
  const [highestRisk, setHighestRisk] = useState<string>('none')

  async function runCheck() {
    if (!query.trim()) { toast.error('Enter a name, company, or reference to search'); return }
    setRunning(true)
    try {
      const res = await fetch('/api/conflict-checks/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
        setHighestRisk(data.highest_risk || 'none')
        // Pinned at the moment of the search, so editing the box afterwards
        // can't relabel a result set as being for a term never searched.
        setRanFor(query.trim())
        setHasRun(true)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not run the check')
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={ShieldAlert}
        eyebrow="Matters"
        title="Conflict Check"
        description="A quick pre-instruction search, before there's an enquiry or matter to attach it to. It searches the same firm-wide records (matters, opposing parties, prior intake, people on file) as the check inside a matter's Lifecycle."
      />

      {/* Stated up front rather than buried in the description: this screen
          writes nothing, so a decision made here is not on file. */}
      <div className="card p-4 mb-6 border-l-[3px] flex items-start gap-3" style={{ borderLeftColor: 'var(--color-brand)' }}>
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-brand)]" />
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          <strong className="text-[var(--color-text-primary)]">Nothing here is saved.</strong>{' '}
          Once you take the instruction, run the formal check from the intake or the matter&apos;s Conflict Check stage so the decision is recorded on file.
        </p>
      </div>

      <div className="flex gap-2 mb-6 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            className="input !pl-9 text-sm"
            placeholder="Search a name, company, or reference…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runCheck()}
          />
        </div>
        <button onClick={runCheck} disabled={running} className="btn btn-primary gap-2 text-sm flex-shrink-0">
          {running ? 'Checking…' : 'Check Conflicts'}
        </button>
      </div>

      {hasRun && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {results.length === 0 ? 'No matches found' : `${results.length} match${results.length === 1 ? '' : 'es'} found`} for &ldquo;{ranFor}&rdquo;
            </span>
            {highestRisk !== 'none' && (
              <StatusPill tone={RISK_TONE[highestRisk] || 'neutral'} dot>{highestRisk} risk</StatusPill>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card p-6 flex items-center gap-3 text-sm text-[var(--color-text-secondary)] border-l-[3px]" style={{ borderLeftColor: 'var(--status-success)' }}>
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-[var(--status-success)]" />
              No existing matter, opposing party, prior intake, or person on file matches this search.
            </div>
          ) : (
            <div className="card divide-y divide-[var(--color-border)]">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm py-3 px-4">
                  <div className="min-w-0">
                    <span className="font-medium text-[var(--color-text-primary)]">{r.match_type}</span>
                    <span className="text-[var(--color-text-muted)]">, {r.name}</span>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.detail}</div>
                  </div>
                  <StatusPill tone={RISK_TONE[r.risk] || 'neutral'} dot>{r.risk}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
