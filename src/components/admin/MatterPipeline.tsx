'use client'
import { useEffect, useState } from 'react'
import { Check, Loader2, ArrowRight, ListPlus, NotebookPen, ArrowUpRight, Send, Calculator } from 'lucide-react'
import Link from 'next/link'
import { formatDate, getStatusColor } from '@/lib/utils'
import { availableTransitions, stageLabel, stageMeta, stageTaskSuggestions, MATTER_HAPPY_PATH, type MatterStage } from '@/lib/matterLifecycle'
import SectionCard from '@/components/admin/SectionCard'
import AssignmentComposer, { type ComposerTeamMember } from '@/components/admin/AssignmentComposer'
import ConflictCheckPanel from '@/components/admin/ConflictCheckPanel'
import StageActions from '@/components/admin/StageActions'
import type { WorkContext } from '@/lib/workContext'

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
export default function MatterPipeline({
  status, stageHistory, conflictChecks, permissions, onConflictChanged,
  canMakeTransition, onTransitionClick,
  submissionOrigin, clientInstruction, description,
  team, context, onAssignmentCreated,
  noteDraft, setNoteDraft, addingNote, onAddNote,
  onInvokeService, onInvokeCostEstimate,
}: {
  status?: string | null
  stageHistory: StageHistoryEntry[]
  conflictChecks: ConflictCheck[]
  permissions: string[]
  /** Re-fetch after a search or a partner decision, both can move the stage. */
  onConflictChanged: () => void
  canMakeTransition: (from: MatterStage, to: MatterStage) => boolean
  onTransitionClick: (to: MatterStage) => void
  submissionOrigin?: { id: string; tracking_code: string; created_at: string } | null
  clientInstruction?: string | null
  description?: string | null
  team: ComposerTeamMember[]
  /** Everything an assignment raised here should inherit, resolved by the page. */
  context: WorkContext
  onAssignmentCreated: () => void
  noteDraft: string
  setNoteDraft: (v: string) => void
  addingNote: boolean
  onAddNote: () => void
  onInvokeService: () => void
  onInvokeCostEstimate: () => void
}) {
  // Older/imported matter rows can briefly arrive without a status while
  // the detail page is loading. Treat that safely as the lifecycle entry
  // state rather than passing undefined into label/transition helpers.
  const currentStatus = status || 'lead'
  const offPath = currentStatus === 'declined' || currentStatus === 'archived'
  const effectiveStatus: MatterStage = currentStatus === 'on_hold' ? 'open' : (currentStatus as MatterStage)
  const currentIdx = offPath ? -1 : MATTER_HAPPY_PATH.indexOf(effectiveStatus)

  // Lead is the entry point, opens on the facts and full history, not
  // straight into an action panel. Acting on a stage is something you
  // choose to click into from there, not the default view.
  const [selectedStage, setSelectedStage] = useState<MatterStage>('lead')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  useEffect(() => {
    setSelectedStage('lead')
    setShowTaskForm(false)
    setShowNoteForm(false)
  }, [currentStatus])

  const selectedIsLive = selectedStage === effectiveStatus
  const isLead = selectedStage === 'lead'
  const stageEntries = stageHistory.filter(h => h.to_stage === selectedStage)
  const canManage = permissions.includes('manage_matters')

  const taskSuggestions = stageTaskSuggestions(currentStatus)

  return (
    <SectionCard
      title="Lifecycle"
      icon={ArrowRight}
      color="blue"
      defaultOpen
      badge={<span className={`badge ${getStatusColor(currentStatus)} ml-1`}>{stageMeta(currentStatus).label}</span>}
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
          This matter is {stageMeta(currentStatus).label.toLowerCase()}.
        </div>
      )}
      {currentStatus === 'on_hold' && selectedStage === 'open' && (
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
              <ConflictCheckPanel
                context={context}
                checks={conflictChecks}
                permissions={permissions}
                canRun={selectedIsLive}
                onChanged={onConflictChanged}
              />
            </div>
          )}

          {/* Actions that apply at this stage, only on the real current
              stage, viewing a past step never lets you act on it. */}
          {selectedIsLive && !offPath && (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <div className="flex flex-wrap gap-2 mb-2">
                {availableTransitions(currentStatus as MatterStage)
                  .filter((to) => canMakeTransition(currentStatus as MatterStage, to))
                  .map((to) => (
                    <button key={to} onClick={() => onTransitionClick(to)} className="btn btn-outline gap-2 text-sm">
                      <ArrowRight className="w-4 h-4" /> {stageLabel(to)}
                    </button>
                  ))}
                {/* Stage-appropriate actions come from the registry rather
                    than a fixed list here, so what's offered at "retainer
                    pending" differs from "open" without a branch in this file. */}
                <StageActions
                  stageKey={currentStatus}
                  context={context}
                  permissions={permissions}
                  handlers={{
                    assign_task: () => setShowTaskForm(true),
                    record_note: () => setShowNoteForm(v => !v),
                    log_service: onInvokeService,
                    estimate_costs: onInvokeCostEstimate,
                  }}
                />
              </div>

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

      {/* The same composer the intake pipeline uses. It inherits the matter,
          the live stage and the client from the context the page resolved,
          so none of that is re-entered here. */}
      <AssignmentComposer
        open={showTaskForm}
        onClose={() => setShowTaskForm(false)}
        context={context}
        team={team}
        suggestions={taskSuggestions}
        title={`Assign work at ${stageLabel(currentStatus).toLowerCase()}`}
        onCreated={onAssignmentCreated}
      />
    </SectionCard>
  )
}
