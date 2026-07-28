'use client'
import { useEffect, useState } from 'react'
import { Check, Loader2, Search, AlertTriangle, XCircle, MessageSquare, GitBranch } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { INTAKE_HAPPY_PATH, intakeStageMeta, intakeStagePermission, type IntakeStage } from '@/lib/intakeLifecycle'
import SectionCard from '@/components/admin/SectionCard'

interface ConflictMatch { match_type: string; name: string; detail: string; risk: 'low' | 'medium' | 'high' }
interface ConflictCheck {
  id: string
  search_query: string
  results: ConflictMatch[]
  highest_risk: string | null
  decision: string
  decision_notes: string | null
  created_at: string
  checker?: { full_name: string } | null
  decider?: { full_name: string } | null
}
interface SubmissionNote {
  id: string
  content: string
  stage: string | null
  created_at: string
  author?: { full_name: string } | null
}

// The steps between Problem Identification and Retention are all the same
// shape: a short note recording what actually happened, then a move to the
// next step. Conflict Check (a live search) and Retention (which only
// advances via an actual promotion, not a click here) are handled on their
// own.
const NOTE_STAGES: Partial<Record<IntakeStage, { next: IntakeStage; cta: string; placeholder: string }>> = {
  problem_identification: { next: 'client_instruction', cta: 'Mark Identified & Continue', placeholder: "What does the client actually need, in the firm's own words…" },
  client_instruction: { next: 'legal_opinion', cta: 'Record Instruction & Continue', placeholder: 'What has the client asked the firm to do…' },
  legal_opinion: { next: 'retention', cta: 'Record Opinion & Continue', placeholder: 'The advice given in response to the instruction…' },
}

export default function PipelineStepper({ submissionId, intakeStage, onAdvance }: {
  submissionId: string
  intakeStage: IntakeStage | null
  onAdvance: () => void
}) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [conflictChecks, setConflictChecks] = useState<ConflictCheck[]>([])
  const [notes, setNotes] = useState<SubmissionNote[]>([])
  const [conflictQuery, setConflictQuery] = useState('')
  const [runningCheck, setRunningCheck] = useState(false)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [decisionDraft, setDecisionDraft] = useState<Record<string, string>>({})
  const [noteDraft, setNoteDraft] = useState('')
  const [advancing, setAdvancing] = useState<string | null>(null)

  const stage: IntakeStage = intakeStage || 'received'
  // Which step the pipeline is showing the detail pane for, defaults to
  // whatever is actually live, but clicking any reached step just looks at
  // it without changing anything, so the card never dumps every step's
  // history at once.
  const [selectedStage, setSelectedStage] = useState<IntakeStage>(stage)
  useEffect(() => { setSelectedStage(stage) }, [stage])

  function load() {
    Promise.all([
      fetch('/api/me').then(r => (r.ok ? r.json() : { permissions: [] })).catch(() => ({ permissions: [] })),
      fetch(`/api/conflict-checks?submission_id=${submissionId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/submission-notes?submission_id=${submissionId}`).then(r => r.json()).catch(() => []),
    ]).then(([me, checks, n]) => {
      setPermissions(me.permissions || [])
      setConflictChecks(Array.isArray(checks) ? checks : [])
      setNotes(Array.isArray(n) ? n : [])
    })
  }

  useEffect(() => { load() }, [submissionId])

  async function runConflictCheck() {
    if (!conflictQuery.trim()) { toast.error('Enter a name or reference to search'); return }
    setRunningCheck(true)
    try {
      const res = await fetch('/api/conflict-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, query: conflictQuery.trim() }),
      })
      if (res.ok) {
        setConflictQuery('')
        load()
        onAdvance()
        toast.success('Conflict check complete')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not run the check')
      }
    } finally { setRunningCheck(false) }
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
        load()
        onAdvance()
        toast.success(decision === 'declined' ? 'Enquiry declined' : 'Decision recorded, pipeline advanced')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not record the decision')
      }
    } finally { setDecidingId(null) }
  }

  async function advanceStage(to: IntakeStage, note?: string) {
    setAdvancing(to)
    try {
      const res = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake_stage: to, intake_note: note?.trim() || undefined }),
      })
      if (res.ok) {
        setNoteDraft('')
        load()
        onAdvance()
        toast.success(to === 'declined' ? 'Enquiry declined' : `Moved to ${intakeStageMeta(to).label}`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not advance the pipeline')
      }
    } finally { setAdvancing(null) }
  }

  const declined = stage === 'declined'
  const promoted = stage === 'promoted'
  const currentIdx = declined ? -1 : promoted ? INTAKE_HAPPY_PATH.length : INTAKE_HAPPY_PATH.indexOf(stage)
  const canDecline = !declined && !promoted
  const selectedIsLive = selectedStage === stage
  const noteStep = NOTE_STAGES[selectedStage]
  const canManage = permissions.includes(intakeStagePermission(stage, NOTE_STAGES[stage]?.next || 'declined'))
  const selectedNotes = notes.filter(n => n.stage === selectedStage)

  return (
    <SectionCard
      title="Intake Pipeline"
      icon={GitBranch}
      color="blue"
      defaultOpen={!promoted}
      badge={
        <>
          {declined && <span className="badge status-rejected ml-1">Declined</span>}
          {promoted && <span className="badge status-active ml-1">Promoted to Matter</span>}
        </>
      }
    >
      {/* Stepper track, spans the whole pre-matter journey. A step is
          ticked the moment its outcome actually happened, not on a
          separate manual confirmation. Any reached step is clickable, the
          pane below shows only that one step, not everything at once. */}
      <div className="flex items-start mb-6 overflow-x-auto pb-1">
        {INTAKE_HAPPY_PATH.map((s, i) => {
          const done = promoted || i < currentIdx
          const current = i === currentIdx && !declined && !promoted
          const reached = done || current
          const selected = s === selectedStage
          return (
            <div key={s} className="flex items-start flex-1 min-w-[108px] last:flex-none last:min-w-0">
              <button
                type="button"
                disabled={!reached}
                onClick={() => setSelectedStage(s)}
                className={`flex flex-col items-center gap-1.5 flex-shrink-0 ${reached ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ width: '108px' }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  done ? 'bg-[var(--color-accent)] text-white' : current ? 'border-2 border-[var(--color-accent)] text-[var(--color-accent)]' : 'bg-[var(--color-border)] text-[var(--color-muted)]'
                } ${selected ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] ring-offset-[var(--color-surface)]' : ''}`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-semibold">{i + 1}</span>}
                </div>
                <span className={`text-[10px] uppercase tracking-wide text-center leading-tight ${selected ? 'text-[var(--color-accent)] font-semibold' : done ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-muted)]'}`}>
                  {intakeStageMeta(s).label}
                </span>
              </button>
              {i < INTAKE_HAPPY_PATH.length - 1 && (
                <div className={`h-px flex-1 mt-3 ${done ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {declined && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-400 flex items-center gap-2 mb-2">
          <XCircle className="w-4 h-4 flex-shrink-0" /> This enquiry was declined and will not proceed to a matter.
        </div>
      )}

      {/* Detail pane for whichever step is selected, the live step opens
          with its action (search box, note form); a past step just shows
          what happened there. */}
      {(selectedStage === 'received' || selectedStage === 'conflict_check') && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-display font-semibold text-sm text-[var(--color-text-primary)]">Conflict of Interest Check</h3>
          </div>

          {selectedIsLive && (stage === 'received' || stage === 'conflict_check') && (
            <>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                Professional obligation: search current and former clients, opposing parties, and related matters before anything else happens. A documented decision to proceed is required before this enquiry can move forward.
              </p>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                  <input
                    className="input pl-9 text-sm"
                    placeholder="Search a name, company, or reference…"
                    value={conflictQuery}
                    onChange={e => setConflictQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runConflictCheck()}
                  />
                </div>
                <button onClick={runConflictCheck} disabled={runningCheck} className="btn btn-primary gap-2 text-sm flex-shrink-0">
                  {runningCheck ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Check Conflicts
                </button>
              </div>
            </>
          )}

          {conflictChecks.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">No conflict checks run yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {conflictChecks.map(check => (
                <div key={check.id} className="card p-4" style={{ background: 'var(--color-surface-raised)' }}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">Results for &quot;{check.search_query}&quot;</div>
                    <div className="flex items-center gap-2">
                      {check.highest_risk && check.highest_risk !== 'none' && (
                        <span className={`badge text-xs ${check.highest_risk === 'high' ? 'status-rejected' : check.highest_risk === 'medium' ? 'status-pending' : 'status-review'}`}>
                          {check.highest_risk} risk
                        </span>
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
                            <span className="font-medium text-[var(--color-text-primary)]">{r.match_type}</span>
                            <span className="text-[var(--color-muted)]">, {r.name} · {r.detail}</span>
                          </div>
                          <span className={`badge text-xs flex-shrink-0 ${r.risk === 'high' ? 'status-rejected' : r.risk === 'medium' ? 'status-pending' : 'status-review'}`}>{r.risk}</span>
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
                      <span className={`badge text-xs ${check.decision === 'declined' ? 'status-rejected' : 'status-active'}`}>{check.decision.replace(/_/g, ' ')}</span>
                      {check.decision_notes && <p className="text-[var(--color-text-secondary)] mt-1.5">{check.decision_notes}</p>}
                      {check.decider?.full_name && <p className="text-[var(--color-muted)] mt-1">Decided by {check.decider.full_name}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Problem Identification / Client Instruction / Legal Opinion: each
          one records a short note of what actually happened, then moves on. */}
      {noteStep && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="font-display font-semibold text-sm text-[var(--color-text-primary)]">{intakeStageMeta(selectedStage).label}</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">{intakeStageMeta(selectedStage).description}</p>

          {selectedIsLive ? (
            canManage ? (
              <div className="flex flex-col gap-2 mb-3">
                <textarea
                  rows={3}
                  className="input text-sm"
                  placeholder={noteStep.placeholder}
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => advanceStage(noteStep.next, noteDraft)} disabled={advancing === noteStep.next} className="btn btn-primary gap-2 text-sm">
                    {advancing === noteStep.next ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {noteStep.cta}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)] italic mb-3">Requires the &quot;Submissions&quot; permission to record and advance this step.</p>
            )
          ) : null}

          {selectedNotes.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">No note recorded for this step yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedNotes.map(n => (
                <div key={n.id} className="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-overlay)]">
                  <div className="text-[var(--color-muted)] mb-1">{formatDate(n.created_at, 'short')}{n.author?.full_name ? ` · ${n.author.full_name}` : ''}</div>
                  <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedStage === 'retention' && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="font-display font-semibold text-sm text-[var(--color-text-primary)]">Retention</h3>
          </div>
          {selectedIsLive && (
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              The client has retained the firm. Use the &quot;Promote to Matter&quot; panel to open the matter, that action is what completes this step.
            </p>
          )}
          {selectedNotes.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)]">No note recorded for this step yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedNotes.map(n => (
                <div key={n.id} className="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-overlay)]">
                  <div className="text-[var(--color-muted)] mb-1">{formatDate(n.created_at, 'short')}{n.author?.full_name ? ` · ${n.author.full_name}` : ''}</div>
                  <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedStage === 'promoted' && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4 text-[var(--color-accent)]" />
            <h3 className="font-display font-semibold text-sm text-[var(--color-text-primary)]">Promoted to Matter</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">This enquiry became a matter. Its own Lifecycle continues from here.</p>
        </div>
      )}

      {canDecline && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <button onClick={() => advanceStage('declined', noteDraft)} disabled={advancing === 'declined'} className="text-xs text-red-500 hover:underline">
            Decline this enquiry
          </button>
        </div>
      )}
    </SectionCard>
  )
}
