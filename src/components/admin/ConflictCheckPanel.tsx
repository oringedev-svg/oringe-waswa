'use client'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import StatusPill, { type Tone } from '@/components/admin/ui/StatusPill'
import { CONFLICT_ROLE_LABELS, CONFLICT_TARGET_ROLES, type ConflictTarget } from '@/lib/conflictSearch'
import type { WorkContext } from '@/lib/workContext'

// ============================================================
// CONFLICT CHECK PANEL
// ============================================================
// The conflict search, its results and the partner decision, in one place.
// The matter lifecycle and the intake pipeline previously carried their own
// near-identical copies of all three; this is that UI once.
//
// The search itself now covers every party at once. It opens pre-populated
// with whoever the enquiry is already about, because making someone retype a
// name the system is already displaying is how a party gets missed.

export interface ConflictMatchView {
  match_type: string
  name: string
  detail: string
  risk: 'low' | 'medium' | 'high'
  target?: string
  target_role?: string
}

export interface ConflictCheckView {
  id: string
  search_query: string
  results: ConflictMatchView[]
  highest_risk: string | null
  decision: string
  decision_notes: string | null
  created_at: string
  checker?: { full_name: string } | null
  decider?: { full_name: string } | null
}

const RISK_TONE: Record<string, Tone> = { high: 'overdue', medium: 'risk', low: 'review' }
const DECISION_TONE: Record<string, Tone> = { declined: 'overdue', proceed: 'safe', proceed_with_conditions: 'risk' }

export default function ConflictCheckPanel({
  context, checks, permissions, canRun, onChanged,
}: {
  context: WorkContext
  checks: ConflictCheckView[]
  permissions: string[]
  /** False when viewing a stage that isn't live, results stay readable but no new search. */
  canRun: boolean
  onChanged: () => void
}) {
  const [targets, setTargets] = useState<ConflictTarget[]>([])
  const [running, setRunning] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [decisionDraft, setDecisionDraft] = useState<Record<string, string>>({})

  // Seed with the party the record is already about. Editable and removable,
  // it's a starting point, not a fixed row.
  useEffect(() => {
    setTargets(context.clientName ? [{ name: context.clientName, role: 'client' }] : [{ name: '', role: 'client' }])
  }, [context.clientName, context.matterId, context.submissionId])

  function updateTarget(i: number, patch: Partial<ConflictTarget>) {
    setTargets(ts => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function removeTarget(i: number) {
    setTargets(ts => (ts.length === 1 ? ts : ts.filter((_, idx) => idx !== i)))
  }
  function addTarget() {
    setTargets(ts => [...ts, { name: '', role: 'opposing_party' }])
  }

  async function run() {
    const filled = targets.filter(t => t.name.trim())
    if (filled.length === 0) { toast.error('Add at least one name to search'); return }
    setRunning(true)
    try {
      const res = await fetch('/api/conflict-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: context.matterId || undefined,
          submission_id: context.submissionId || undefined,
          targets: filled,
        }),
      })
      if (res.ok) {
        toast.success(`Checked ${filled.length} ${filled.length === 1 ? 'party' : 'parties'}`)
        onChanged()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not run the check')
      }
    } finally { setRunning(false) }
  }

  async function recordDecision(id: string, decision: string) {
    setDecidingId(id)
    try {
      const res = await fetch('/api/conflict-checks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, decision_notes: decisionDraft[id] || '' }),
      })
      if (res.ok) {
        toast.success(decision === 'declined' ? 'Declined' : 'Decision recorded')
        onChanged()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not record the decision')
      }
    } finally { setDecidingId(null) }
  }

  return (
    <div>
      {canRun && (
        <div className="flex flex-col gap-2 mb-4">
          {targets.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Name, company or reference…"
                  value={t.name}
                  onChange={e => updateTarget(i, { name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && run()}
                />
              </div>
              <select
                className="input text-sm w-40 flex-shrink-0"
                value={t.role || ''}
                onChange={e => updateTarget(i, { role: e.target.value })}
                aria-label="Relationship to this matter"
              >
                {CONFLICT_TARGET_ROLES.map(r => (
                  <option key={r} value={r}>{CONFLICT_ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button
                onClick={() => removeTarget(i)}
                disabled={targets.length === 1}
                className="btn btn-ghost p-2 !px-2 flex-shrink-0 disabled:opacity-30"
                aria-label={`Remove ${t.name || 'this target'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <button onClick={addTarget} className="btn btn-ghost gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add another person/company
            </button>
            <button onClick={run} disabled={running} className="btn btn-primary gap-2 text-sm ml-auto">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Check Conflicts
            </button>
          </div>
        </div>
      )}

      {checks.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)]">No conflict checks run yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {checks.map(check => (
            <div key={check.id} className="card p-4" style={{ background: 'var(--color-surface-raised)' }}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  Searched: {check.search_query}
                </div>
                <div className="flex items-center gap-2">
                  {check.highest_risk && check.highest_risk !== 'none' && (
                    <StatusPill tone={RISK_TONE[check.highest_risk] || 'neutral'} dot>{check.highest_risk} risk</StatusPill>
                  )}
                  <span className="text-xs text-[var(--color-muted)]">{formatDate(check.created_at, 'short')}</span>
                </div>
              </div>

              {check.results.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No matches found.</p>
              ) : (
                <div className="flex flex-col gap-1.5 mb-3">
                  {check.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-[var(--color-surface)] gap-2">
                      <div className="min-w-0">
                        {/* Which searched party caused the hit, otherwise a
                            multi-party check is a list with no attribution. */}
                        {r.target && (
                          <span className="text-[var(--color-accent)] font-medium">
                            {r.target}{r.target_role ? ` (${CONFLICT_ROLE_LABELS[r.target_role] || r.target_role})` : ''}:{' '}
                          </span>
                        )}
                        <span className="font-medium text-[var(--color-text-primary)]">{r.match_type}</span>
                        <span className="text-[var(--color-muted)]">, {r.name} · {r.detail}</span>
                      </div>
                      <StatusPill tone={RISK_TONE[r.risk] || 'neutral'}>{r.risk}</StatusPill>
                    </div>
                  ))}
                </div>
              )}

              {check.decision === 'pending' ? (
                permissions.includes('approve_conflict_waiver') ? (
                  <div className="pt-3 border-t border-[var(--color-border)]">
                    <label className="label">Partner decision (required before proceeding)</label>
                    <textarea
                      rows={2}
                      className="input text-sm mb-2"
                      placeholder="Notes / basis for decision…"
                      value={decisionDraft[check.id] || ''}
                      onChange={e => setDecisionDraft(d => ({ ...d, [check.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => recordDecision(check.id, 'proceed')} disabled={decidingId === check.id} className="btn btn-primary text-xs">Proceed</button>
                      <button onClick={() => recordDecision(check.id, 'proceed_with_conditions')} disabled={decidingId === check.id} className="btn btn-outline text-xs">Proceed with Conditions</button>
                      <button onClick={() => recordDecision(check.id, 'declined')} disabled={decidingId === check.id} className="btn btn-ghost text-xs text-red-500">Decline</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-muted)] italic pt-3 border-t border-[var(--color-border)]">
                    Awaiting partner review, requires the &quot;Approve Conflict Decisions&quot; permission.
                  </p>
                )
              ) : (
                <div className="pt-3 border-t border-[var(--color-border)] text-xs">
                  <StatusPill tone={DECISION_TONE[check.decision] || 'neutral'}>{check.decision.replace(/_/g, ' ')}</StatusPill>
                  {check.decision_notes && <p className="text-[var(--color-text-secondary)] mt-1.5">{check.decision_notes}</p>}
                  {check.decider?.full_name && <p className="text-[var(--color-muted)] mt-1">Decided by {check.decider.full_name}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
