'use client'
import { useState } from 'react'
import { Search, Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface ConflictMatch { match_type: string; name: string; detail: string; risk: 'low' | 'medium' | 'high' }

export default function ConflictCheckPage() {
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Conflict Check</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Quick pre-instruction search, before there's an enquiry or matter to attach it to. Searches the same firm-wide
          records (matters, opposing parties, prior intake, people on file) as the check inside a matter's Lifecycle.
          This is a quick look only, nothing here is saved. Once you take the instruction, run the formal check from
          the intake or matter's Conflict Check stage so the decision is recorded on file.
        </p>
      </div>

      <div className="flex gap-2 mb-6 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search a name, company, or reference…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runCheck()}
          />
        </div>
        <button onClick={runCheck} disabled={running} className="btn btn-primary gap-2 text-sm flex-shrink-0">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Check Conflicts
        </button>
      </div>

      {hasRun && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {results.length === 0 ? 'No matches found' : `${results.length} match${results.length === 1 ? '' : 'es'} found`} for &quot;{query}&quot;
            </span>
            {highestRisk !== 'none' && (
              <span className={`badge text-xs ${highestRisk === 'high' ? 'status-rejected' : highestRisk === 'medium' ? 'status-pending' : 'status-review'}`}>
                {highestRisk} risk
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card p-6 flex items-center gap-3 text-sm text-[var(--color-muted)]">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              No existing matter, opposing party, prior intake, or person on file matches this search.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-[var(--color-text-primary)]">{r.match_type}</span>
                    <span className="text-[var(--color-muted)]">, {r.name} · {r.detail}</span>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${r.risk === 'high' ? 'status-rejected' : r.risk === 'medium' ? 'status-pending' : 'status-review'}`}>{r.risk}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
