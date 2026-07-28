'use client'
import { useEffect, useState } from 'react'
import { Lightbulb, Scale, Plus, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionCard from '@/components/admin/SectionCard'

interface Solution {
  id: string
  priority: number
  solution: string
  prerequisite: string | null
  is_court_track: boolean
  notes: string | null
}

interface Problem {
  id: string
  category: string
  title: string
  description: string | null
  typical_client: string | null
  limitation_period: string | null
  solutions: Solution[]
}

interface CourtRule {
  id: string
  label: string
  court_name: string
  registry_notes: string | null
}

interface CourtGuidance {
  category: string
  matched: CourtRule[]
}

export default function SuggestedSolutions({ matterType, claimValue, county, matterId, submissionId, onTaskAdded }: {
  matterType: string | null | undefined
  claimValue?: number | null
  county?: string | null
  matterId?: string
  submissionId?: string
  onTaskAdded?: () => void
}) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [courtGuidance, setCourtGuidance] = useState<CourtGuidance | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addingTask, setAddingTask] = useState<string | null>(null)

  useEffect(() => {
    if (!matterType) { setProblems([]); setCourtGuidance(null); return }
    setLoading(true)
    const params = new URLSearchParams({ matter_type: matterType })
    if (claimValue) params.set('claim_value', String(claimValue))
    fetch(`/api/legal-knowledge/suggestions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setProblems(Array.isArray(d.problems) ? d.problems : [])
        setCourtGuidance(d.court_guidance || null)
      })
      .catch(() => { setProblems([]); setCourtGuidance(null) })
      .finally(() => setLoading(false))
  }, [matterType, claimValue])

  async function addAsTask(solution: Solution) {
    if (!matterId && !submissionId) return
    setAddingTask(solution.id)
    try {
      const res = await fetch('/api/matter-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: matterId,
          submission_id: submissionId,
          title: solution.solution,
        }),
      })
      if (res.ok) {
        toast.success('Added to Next Steps')
        onTaskAdded?.()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not add the task')
      }
    } finally {
      setAddingTask(null)
    }
  }

  if (!matterType) return null
  if (!loading && problems.length === 0 && !courtGuidance) return null

  return (
    <SectionCard title="Suggested Solutions" icon={Lightbulb} color="green">
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Drawn from the firm&apos;s problem/solution library, a starting point, review before relying on it.
      </p>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" /></div>
      ) : (
        <>
          {courtGuidance && courtGuidance.matched.length > 0 && (
            <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Scale className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">Court &amp; Registry Guidance</span>
              </div>
              {courtGuidance.matched.map((r) => (
                <div key={r.id} className="text-xs text-[var(--color-text-secondary)] mb-1 last:mb-0">
                  <span className="font-medium text-[var(--color-text-primary)]">{r.court_name}</span>
                  {r.registry_notes && <span>, {r.registry_notes}</span>}
                  {county && <span className="text-[var(--color-muted)]"> (matter based in {county})</span>}
                </div>
              ))}
            </div>
          )}

          {problems.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No matching problems in the library yet for this matter type.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map((p) => {
                const isOpen = expanded[p.id] ?? problems.length === 1
                return (
                  <div key={p.id} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen }))}
                      className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-[var(--color-surface-overlay)] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{p.title}</div>
                        {p.description && <div className="text-xs text-[var(--color-muted)] line-clamp-1">{p.description}</div>}
                      </div>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 pt-0 flex flex-col gap-2">
                        {p.limitation_period && (
                          <p className="text-xs text-[var(--color-muted)]">Typical limitation period: {p.limitation_period}</p>
                        )}
                        {p.solutions.map((s) => (
                          <div key={s.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-md bg-[var(--color-surface-overlay)]">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-[var(--color-accent)]">{s.priority}.</span>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.solution}</span>
                                {s.is_court_track && <span className="badge status-pending text-xs">Court Track</span>}
                              </div>
                              {s.prerequisite && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.prerequisite}</p>}
                            </div>
                            {(matterId || submissionId) && (
                              <button
                                onClick={() => addAsTask(s)}
                                disabled={addingTask === s.id}
                                className="btn btn-outline text-xs gap-1 flex-shrink-0"
                              >
                                {addingTask === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                Add as Task
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}
