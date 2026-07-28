'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2, Scale } from 'lucide-react'

interface CaseResult {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  description?: string
  client_type?: string
  year?: number
}

export default function CaseResultsPage() {
  const [results, setResults] = useState<CaseResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/case-results')
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout>
      <div className="py-20" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Track Record</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Case Results</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">
            A selection of outcomes we've secured for clients across our practice areas. Client identities are always anonymized.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : results.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">Case results coming soon.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((r, i) => (
                <div key={r.id} className={`card p-6 reveal stagger-${Math.min(i % 4 + 1, 4)}`}>
                  <Scale className="w-5 h-5 text-[var(--color-accent)] mb-4" strokeWidth={1.5} />
                  <div className="font-display text-xl font-semibold text-[var(--color-text-primary)] mb-2 leading-snug">{r.outcome}</div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{r.title}</h3>
                  {(r.description || r.summary) && (
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">{r.description || r.summary}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] pt-4 border-t border-[var(--color-border)] flex-wrap">
                    {r.practice_area && <span>{r.practice_area}</span>}
                    {r.client_type && <span>· {r.client_type}</span>}
                    {r.year && <span>· {r.year}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
