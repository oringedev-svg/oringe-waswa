'use client'
import { useEffect, useState } from 'react'
import { Check, Loader2, Search, ArrowRight, ListPlus, NotebookPen, ArrowUpRight, Send, Calculator } from 'lucide-react'
import Link from 'next/link'
import { formatDate, getStatusColor } from '@/lib/utils'
import { availableTransitions, stageLabel, stageMeta, stageTaskSuggestions, type MatterStage } from '@/lib/matterLifecycle'
import SectionCard from '@/components/admin/SectionCard'

// The happy-path nodes shown as the main pipeline row. on_hold pauses
// within "Open" rather than getting its own node; declined/archived are
// off-path terminal states shown as a banner instead of a stepper position
//, same convention as PipelineStepper's declined handling.
const MATTER_HAPPY_PATH: MatterStage[] = ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending', 'open', 'closed']

interface ConflictMatch { match_type: string; name: string; detail: string; risk: 'low' | 'medium' | 'high' }
interface ConflictCheck {
  id: string
  search_query: string
  results: ConflictMatch[]
  highest_risk: string | null
  decision: 'pending' | 'proceed' | 'proceed_with_conditions' | 'declined'
  decision_notes: string | null
  created_at: string
  checker?: { full_name: string } | null
  decider?: { full_name: string } | null
}
interface StageHistoryEntry {
  from_stage: string | null
  to_stage: string
  created_at: string
  actor?: { full_name: string } | null
}
interface TeamMember { id: string; full_name: string; professional_type?: { id: string; name: string } | null }
interface PipelineStageOption { id: string; key: string; label: string }
interface TaskForm { title: string; assigned_to: string; stage_id: string; due_date: string }

export default function MatterPipeline({
  status, stageHistory, conflictChecks, permissions,
  conflictQuery, setConflictQuery, runningCheck, onRunConflictCheck,
  decisionDraft, setDecisionDraft, decidingId, onRecordDecision,
  canMakeTransition, onTransitionClick,
  submissionOrigin, clientInstruction, description,
  team, stages, taskForm, setTaskForm, addingTask, onAddTask,
  noteDraft, setNoteDraft, addingNote, onAddNote,
  onInvokeService, onInvokeCostEstimate,
}: {
  status: string
  stageHistory: StageHistoryEntry[]
  conflictChecks: ConflictCheck[]
  permissions: string[]
  conflictQuery: string
  setConflictQuery: (v: string) => void
  runningCheck: boolean
  onRunConflictCheck: () => void
  decisionDraft: Record<string, string>
  setDecisionDraft: (updater: (d: Record<string, string>) => Record<string, string>) => void
  decidingId: string | null
  onRecordDecision: (checkId: string, decision: string) => void
  canMakeTransition: (from: MatterStage, to: MatterStage) => boolean
  onTransitionClick: (to: MatterStage) => void
  submissionOrigin?: { id: string; tracking_code: string; created_at: string } | null
  clientInstruction?: string | null
  description?: string | null
  team: TeamMember[]
  stages: PipelineStageOption[]
  taskForm: TaskForm
  setTaskForm: (updater: (f: TaskForm) => TaskForm) => void
  addingTask: boolean
  onAddTask: () => void
  noteDraft: string
  setNoteDraft: (v: string) => void
  addingNote: boolean
  onAddNote: () => void
  onInvokeService: () => void
  onInvokeCostEstimate: () => void
}) {
  const offPath = status === 'declined' || status === 'archived'
  const effectiveStatus: MatterStage = status === 'on_hold' ? 'open' : (status as MatterStage)
  const currentIdx = offPath ? -1 : MATTER_HAPPY_PATH.indexOf(effectiveStatus)

  // Lead is the entry point, opens on the facts and full history, not
  // straight into an action panel. Acting on a stage is something you
  // choose to click into from there, not the default view.
  const [selectedStage, setSelectedStage] = useState<MatterStage>('lead')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [taskCategory, setTaskCategory] = useState('')
  const [taskPreset, setTaskPreset] = useState('')
  useEffect(() => {
    setSelectedStage('lead')
    setShowTaskForm(false)
    setShowNoteForm(false)
    setTaskCategory('')
    setTaskPreset('')
  }, [status])

  const selectedIsLive = selectedStage === effectiveStatus
  const isLead = selectedStage === 'lead'
  const stageEntries = stageHistory.filter(h => h.to_stage === selectedStage)
  const canManage = permissions.includes('manage_matters')

  const taskCategories = Array.from(new Set(team.map(t => t.professional_type?.name || 'Unclassified'))).sort()
  const teamInCategory = team.filter(t => (t.professional_type?.name || 'Unclassified') === taskCategory)
  const taskSuggestions = stageTaskSuggestions(status)
  const currentPipelineStage = stages.find(s => s.key === status)

  return (
    <SectionCard
      title="Lifecycle"
      icon={ArrowRight}
      color="blue"
      defaultOpen
      badge={<span className={`badge ${getStatusColor(status)} ml-1`}>{stageMeta(status).label}</span>}
    >
      {/* Stepper track spans the matter's whole life. Any reached step is
          clickable, the pane below shows only whatever is selected. Lead
          carries the facts + full history (see below); it's not a separate
          overview slot. */}
      <div className="flex items-start mb-6 overflow-x-auto pb-1">
        {MATTER_HAPPY_PATH.map((s, i) => {
          const done = i < currentIdx
          const current = i === currentIdx && !offPath
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
                  {stageLabel(s)}
                </span>
              </button>
              {i < MATTER_HAPPY_PATH.length - 1 && (
                <div className={`h-px flex-1 mt-3 ${done ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {offPath && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-400 mb-3">
          This matter is {stageMeta(status).label.toLowerCase()}.
        </div>
      )}
      {status === 'on_hold' && selectedStage === 'open' && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-sm text-amber-700 dark:text-amber-400 mb-3">
          Currently on hold.
        </div>
      )}

      {/* Detail pane for whichever stage is selected. Lead is the entry
          point, it carries the facts and the full history, since that's
          what you need to read before deciding whether to act at all.
          Every other stage shows only its own slice of the history. */}
      <div className="pt-1">
        {isLead ? (
          <>
            {clientInstruction && (
              <div className="mb-3 p-3 rounded-lg bg-[var(--color-surface-overlay)]">
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">Client Instruction</div>
                <p className="text-sm text-[var(--color-text-secondary)] italic leading-relaxed">&ldquo;{clientInstruction}&rdquo;</p>
              </div>
            )}
            {description && (
              <div className="mb-3">
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">Summary of Facts</div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{description}</p>
              </div>
            )}
            {/* Lead is the continuation of the intake pipeline, not a fresh
                start, point at where it came from instead of repeating that
                history here (it's already inline, in the card above). */}
            {submissionOrigin && (
              <div className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-[var(--color-surface-overlay)] mb-1.5">
                <span className="text-[var(--color-text-secondary)]">
                  Instructed via enquiry {submissionOrigin.tracking_code} on {formatDate(submissionOrigin.created_at, 'short')}, full record in the Intake Pipeline above.
                </span>
                <Link href={`/admin/submissions/${submissionOrigin.id}`} className="text-[var(--color-accent)] hover:underline flex items-center gap-1 flex-shrink-0">
                  Open <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            )}
            {stageHistory.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)] mb-3">No history yet.</p>
            ) : (
              <div className="mb-3">
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1.5">History</div>
                <div className="flex flex-col gap-1.5">
                  {stageHistory.map((h, i) => (
                    <div key={i} className="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-overlay)] flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[var(--color-text-secondary)]">
                        {h.from_stage ? `${stageLabel(h.from_stage)} → ${stageLabel(h.to_stage)}` : `Opened at ${stageLabel(h.to_stage)}`}
                      </span>
                      <span className="text-[var(--color-muted)]">{formatDate(h.created_at, 'short')}{h.actor?.full_name ? ` · ${h.actor.full_name}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          stageEntries.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)] mb-3">Not reached yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-3">
              {stageEntries.map((h, i) => (
                <div key={i} className="text-xs py-1.5 px-2 rounded bg-[var(--color-surface-overlay)] flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[var(--color-text-secondary)]">
                    {h.from_stage ? `${stageLabel(h.from_stage)} → ${stageLabel(h.to_stage)}` : `Opened at ${stageLabel(h.to_stage)}`}
                  </span>
                  <span className="text-[var(--color-muted)]">{formatDate(h.created_at, 'short')}{h.actor?.full_name ? ` · ${h.actor.full_name}` : ''}</span>
                </div>
              ))}
            </div>
          )
        )}

          {/* Conflict check lives inside its own node, the fix for the
              disconnected-tool problem, still true here. */}
          {selectedStage === 'conflict_check' && (
            <div className="mt-2 mb-3">
              {selectedIsLive && (
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                    <input
                      className="input pl-9 text-sm"
                      placeholder="Search a name, company, or reference…"
                      value={conflictQuery}
                      onChange={e => setConflictQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onRunConflictCheck()}
                    />
                  </div>
                  <button onClick={onRunConflictCheck} disabled={runningCheck} className="btn btn-primary gap-2 text-sm flex-shrink-0">
                    {runningCheck ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Check Conflicts
                  </button>
                </div>
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
                              <button onClick={() => onRecordDecision(check.id, 'proceed')} disabled={decidingId === check.id} className="btn btn-primary text-xs">Proceed</button>
                              <button onClick={() => onRecordDecision(check.id, 'proceed_with_conditions')} disabled={decidingId === check.id} className="btn btn-outline text-xs">Proceed with Conditions</button>
                              <button onClick={() => onRecordDecision(check.id, 'declined')} disabled={decidingId === check.id} className="btn btn-ghost text-xs text-red-500">Decline</button>
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

          {/* Actions that apply at this stage, only on the real current
              stage, viewing a past step never lets you act on it. */}
          {selectedIsLive && !offPath && (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <div className="flex flex-wrap gap-2 mb-2">
                {availableTransitions(status as MatterStage)
                  .filter((to) => canMakeTransition(status as MatterStage, to))
                  .map((to) => (
                    <button key={to} onClick={() => onTransitionClick(to)} className="btn btn-outline gap-2 text-sm">
                      <ArrowRight className="w-4 h-4" /> {stageLabel(to)}
                    </button>
                  ))}
                {canManage && (
                  <>
                    <button
                      onClick={() => {
                        setShowTaskForm(v => !v)
                        if (currentPipelineStage) setTaskForm(f => ({ ...f, stage_id: currentPipelineStage.id }))
                      }}
                      className="btn btn-ghost gap-1.5 text-sm"
                    >
                      <ListPlus className="w-4 h-4" /> Assign Task
                    </button>
                    <button onClick={() => setShowNoteForm(v => !v)} className="btn btn-ghost gap-1.5 text-sm">
                      <NotebookPen className="w-4 h-4" /> Attendance Note
                    </button>
                    <button onClick={onInvokeService} className="btn btn-ghost gap-1.5 text-sm">
                      <Send className="w-4 h-4" /> Log Service
                    </button>
                    <button onClick={onInvokeCostEstimate} className="btn btn-ghost gap-1.5 text-sm">
                      <Calculator className="w-4 h-4" /> Estimate Costs
                    </button>
                  </>
                )}
              </div>

              {showTaskForm && (
                <div className="flex flex-col gap-2 p-3 rounded-md bg-[var(--color-surface-overlay)] mb-2">
                  {!currentPipelineStage && (
                    <p className="text-xs text-amber-600">
                      No pipeline stage is configured for &quot;{stageLabel(status)}&quot; yet, this work item can&apos;t be created until one is.
                    </p>
                  )}
                  {taskSuggestions.length > 0 && (
                    <select
                      className="input text-sm"
                      value={taskPreset}
                      onChange={e => {
                        const v = e.target.value
                        setTaskPreset(v)
                        if (v && v !== '__other__') setTaskForm(f => ({ ...f, title: v }))
                        if (v === '__other__') setTaskForm(f => ({ ...f, title: '' }))
                      }}
                    >
                      <option value="">Milestone task at {stageLabel(status).toLowerCase()}…</option>
                      {taskSuggestions.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="__other__">Other (type your own)…</option>
                    </select>
                  )}
                  {(taskPreset === '__other__' || taskSuggestions.length === 0) && (
                    <input className="input text-sm" placeholder={`What needs to happen at ${stageLabel(status).toLowerCase()}?`}
                      value={taskForm.title}
                      onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && onAddTask()} />
                  )}
                  <div className="flex flex-wrap gap-2 items-end">
                    <select className="input text-sm w-40" value={taskCategory} onChange={e => { setTaskCategory(e.target.value); setTaskForm(f => ({ ...f, assigned_to: '' })) }}>
                      <option value="">Assign to category…</option>
                      {taskCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {taskCategory && (
                      <select className="input text-sm w-44" value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))}>
                        <option value="">Select person…</option>
                        {teamInCategory.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    )}
                    <input type="date" className="input text-sm w-36" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
                    <button onClick={onAddTask} disabled={addingTask || !currentPipelineStage} className="btn btn-primary text-sm">
                      {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {showNoteForm && (
                <div className="flex gap-2 p-3 rounded-md bg-[var(--color-surface-overlay)]">
                  <input className="input text-sm flex-1" placeholder="Record what was done or decided at this stage…"
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onAddNote()} />
                  <button onClick={onAddNote} disabled={addingNote} className="btn btn-primary text-sm flex-shrink-0">
                    {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
    </SectionCard>
  )
}
