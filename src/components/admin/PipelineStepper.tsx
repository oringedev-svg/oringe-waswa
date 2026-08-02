'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, AlertTriangle, XCircle, MessageSquare, GitBranch, ArrowUpRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { INTAKE_HAPPY_PATH, intakeStageMeta, intakeStagePermission, type IntakeStage } from '@/lib/intakeLifecycle'
import SectionCard from '@/components/admin/SectionCard'
import StatusPill, { type Tone } from '@/components/admin/ui/StatusPill'
import AssignmentComposer from '@/components/admin/AssignmentComposer'
import ConflictCheckPanel from '@/components/admin/ConflictCheckPanel'
import StageActions from '@/components/admin/StageActions'
import type { WorkContext } from '@/lib/workContext'

interface AssignmentMessage {
  id: string
  sender_id: string
  message_type: 'Comment' | 'Review' | 'System' | 'Decision'
  content: string
  created_at: string
  sender?: { full_name: string } | null
}

interface StageAssignment {
  id: string
  status: string
  instructions: string | null
  stage_key: string | null
  assignee?: { profile?: { full_name: string } | null } | null
  messages?: AssignmentMessage[]
}

const ASSIGNMENT_STATUS_TONE: Record<string, Tone> = {
  Assigned: 'done',
  Accepted: 'done',
  'In Progress': 'risk',
  Submitted: 'review',
  Approved: 'safe',
  Rejected: 'overdue',
  Revoked: 'neutral',
  Cancelled: 'neutral',
}

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

export default function PipelineStepper({ submissionId, intakeStage, onAdvance, team, submitterName }: {
  submissionId: string
  intakeStage: IntakeStage | null
  onAdvance: () => void
  team?: { id: string; full_name: string }[]
  submitterName?: string
}) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [conflictChecks, setConflictChecks] = useState<ConflictCheck[]>([])
  const [notes, setNotes] = useState<SubmissionNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [advancing, setAdvancing] = useState<string | null>(null)
  const [stageAssignments, setStageAssignments] = useState<StageAssignment[]>([])
  const [showAssignForm, setShowAssignForm] = useState(false)

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
      fetch(`/api/assignments?submission_id=${submissionId}`).then(r => (r.ok ? r.json() : { assignments: [] })).catch(() => ({ assignments: [] })),
    ]).then(([me, checks, n, assignRes]) => {
      setPermissions(me.permissions || [])
      setConflictChecks(Array.isArray(checks) ? checks : [])
      setNotes(Array.isArray(n) ? n : [])
      setStageAssignments(Array.isArray(assignRes.assignments) ? assignRes.assignments : [])
    })
  }

  useEffect(() => { load() }, [submissionId])

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

  // Everything an assignment created from here should inherit. The step being
  // viewed is the stage, not the live one, so work can be handed out for a
  // step that's already been passed.
  const stepContext: WorkContext = {
    submissionId,
    stageKey: selectedStage,
    stageLabel: intakeStageMeta(selectedStage).label,
    clientName: submitterName || null,
  }
  // Just a starting point for the instructions text box now, stepContext's
  // stageKey is what actually links the assignment to this step.
  const defaultStepInstructions =
    `Handle the "${intakeStageMeta(selectedStage).label}" step${submitterName ? ` for ${submitterName}'s enquiry` : ''}.`

  return (
    <SectionCard
      title="Intake Pipeline"
      icon={GitBranch}
      color="blue"
      defaultOpen={!promoted}
      badge={
        <>
          {declined && <StatusPill tone="overdue">Declined</StatusPill>}
          {promoted && <StatusPill tone="safe">Promoted to Matter</StatusPill>}
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

      {/* Assign the step currently being viewed, not the whole enquiry, so
          "run the conflict check" and "record the legal opinion" can go to
          different people. A separate "Assign To" for the whole enquiry
          still lives in the sidebar; this is the per-stage counterpart. */}
      {!declined && !promoted && team && team.length > 0 && (
        <div className="mb-6 pb-6 border-b border-[var(--color-border)]">
          {/* Grouped by stage_key, the real identifier set at creation
              (see workContext.ts's assignmentPayloadFor), not by searching
              instructions for this step's quoted label, that broke the
              moment the text was edited. */}
          {stageAssignments.filter(a => a.stage_key === selectedStage).length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {stageAssignments
                .filter(a => a.stage_key === selectedStage)
                .map(a => {
                  // The status badge alone ("Submitted") told you work had
                  // come back without showing what it was, the write-up
                  // lived only in assignment_messages, one click away on
                  // the assignment's own page. Surfacing the latest
                  // non-system message here means the content is visible
                  // exactly where the badge says it exists.
                  const content = (a.messages || [])
                    .filter(m => m.message_type !== 'System')
                    .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0]
                  return (
                    <div key={a.id} className="rounded-[var(--radius-md)] bg-[var(--color-surface-overlay)] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">{a.assignee?.profile?.full_name || 'Unknown'}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusPill tone={ASSIGNMENT_STATUS_TONE[a.status] || 'neutral'}>{a.status}</StatusPill>
                          <Link href={`/admin/assignments/${a.id}`} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors" title="Open assignment">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                      {content ? (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                          <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{content.content}</p>
                          <p className="text-[0.66rem] text-[var(--color-text-muted)] mt-1.5">
                            {content.sender?.full_name || 'Unknown'} · {formatDate(content.created_at, 'short')}
                          </p>
                        </div>
                      ) : ['Submitted', 'Approved', 'Rejected'].includes(a.status) ? (
                        <p className="text-xs text-[var(--color-text-muted)] italic mt-2 pt-2 border-t border-[var(--color-border)]">
                          Marked {a.status.toLowerCase()} with no written content attached.
                        </p>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          )}

          {/* Contextual actions for the step being viewed, from the same
              registry the matter lifecycle uses. Only what this screen can
              actually carry out is rendered. */}
          <StageActions
            stageKey={selectedStage}
            context={stepContext}
            permissions={permissions}
            handlers={{
              assign_task: () => setShowAssignForm(true),
            }}
          />
        </div>
      )}

      {/* One shared composer, the same component the matter lifecycle uses.
          It inherits the enquiry and the step being viewed, so neither is
          asked for again. */}
      <AssignmentComposer
        open={showAssignForm}
        onClose={() => setShowAssignForm(false)}
        context={stepContext}
        team={team}
        title={`Assign the ${intakeStageMeta(selectedStage).label} step`}
        defaultInstructions={defaultStepInstructions}
        onCreated={load}
      />

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
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Professional obligation: search current and former clients, opposing parties, and related matters before anything else happens. A documented decision to proceed is required before this enquiry can move forward.
            </p>
          )}

          <ConflictCheckPanel
            context={stepContext}
            checks={conflictChecks}
            permissions={permissions}
            canRun={selectedIsLive && (stage === 'received' || stage === 'conflict_check')}
            onChanged={() => { load(); onAdvance() }}
          />
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
