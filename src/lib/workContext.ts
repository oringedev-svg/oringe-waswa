import type { LucideIcon } from 'lucide-react'
import {
  BellPlus, Calculator, CalendarPlus, ClipboardList, FileSignature, Gavel,
  Mail, NotebookPen, Receipt, Search, Send, Upload,
} from 'lucide-react'

// ============================================================
// WORK CONTEXT
// ============================================================
// Every contextual action in the admin (assign work, schedule a meeting,
// upload a document, log a service) needs the same six facts: which matter,
// which enquiry, which stage, which client, who's acting. Before this, each
// call site collected those by hand and passed a different subset, which is
// why the same "Assign Task" ended up implemented three times with three
// different field sets. A WorkContext is that set of facts, resolved once by
// whichever page owns them and handed down, so an action never has to ask
// the user to re-state where they already are.

export interface WorkContext {
  /** Set once the enquiry has been promoted, or when acting on a matter directly. */
  matterId?: string | null
  /** Set while the work still belongs to the pre-matter intake pipeline. */
  submissionId?: string | null
  /** Lifecycle key, e.g. 'conflict_check'. Drives which actions apply. */
  stageKey?: string | null
  /** pipeline_stages.id, the FK assignments actually store. */
  stageId?: string | null
  stageLabel?: string | null
  clientName?: string | null
  clientProfileId?: string | null
  matterNumber?: string | null
  matterTitle?: string | null
  matterType?: string | null
}

/** True when the context points at something an assignment can attach to. */
export function hasTarget(ctx: WorkContext): boolean {
  return Boolean(ctx.matterId || ctx.submissionId)
}

/**
 * The payload every assignment-creating call site should send. Centralised so
 * the three former copies can't drift apart again: the API resolves matter
 * from submission (and vice versa) itself, so callers only pass what they know.
 */
export function assignmentPayloadFor(
  ctx: WorkContext,
  fields: { assigned_to: string; instructions?: string; message?: string; due_date?: string; activity_type_id?: string },
) {
  return {
    matter_id: ctx.matterId || undefined,
    submission_id: ctx.submissionId || undefined,
    stage_id: ctx.stageId || undefined,
    // The real identifier the workflow completion engine and the intake
    // stepper's grouping key off, a plain equality check against
    // legal_matters.status / submissions.intake_stage rather than parsing
    // instructions text for a stage's quoted label.
    stage_key: ctx.stageKey || undefined,
    assigned_to: fields.assigned_to,
    instructions: fields.instructions?.trim() || undefined,
    message: fields.message?.trim() || undefined,
    due_date: fields.due_date || undefined,
    activity_type_id: fields.activity_type_id || undefined,
  }
}

// ============================================================
// CONTEXTUAL ACTIONS
// ============================================================
// A registry, not a switch statement. Adding an action to a stage is a data
// edit here (and later, a row in pipeline_stages), never a new branch in JSX.

export type WorkActionId =
  | 'assign_task'
  | 'schedule_meeting'
  | 'upload_document'
  | 'record_note'
  | 'log_service'
  | 'estimate_costs'
  | 'send_email'
  | 'generate_letter'
  | 'create_reminder'
  | 'run_conflict_search'
  | 'record_decision'
  | 'record_payment'
  | 'notify_client'

export interface WorkActionDef {
  id: WorkActionId
  label: string
  icon: LucideIcon
  /** Permission key required to see the action at all. */
  permission?: string
  /** 'matter' actions are meaningless before promotion. */
  requires?: 'matter' | 'submission' | 'either'
}

export const WORK_ACTIONS: Record<WorkActionId, WorkActionDef> = {
  assign_task:         { id: 'assign_task',         label: 'Assign Task',      icon: ClipboardList,  permission: 'manage_matters', requires: 'either' },
  schedule_meeting:    { id: 'schedule_meeting',    label: 'Schedule Meeting', icon: CalendarPlus,   requires: 'either' },
  upload_document:     { id: 'upload_document',     label: 'Upload Document',  icon: Upload,         permission: 'manage_matters', requires: 'either' },
  record_note:         { id: 'record_note',         label: 'Record Note',      icon: NotebookPen,    permission: 'manage_matters', requires: 'either' },
  log_service:         { id: 'log_service',         label: 'Log Service',      icon: Send,           permission: 'manage_matters', requires: 'matter' },
  estimate_costs:      { id: 'estimate_costs',      label: 'Estimate Costs',   icon: Calculator,     permission: 'manage_matter_costs', requires: 'matter' },
  send_email:          { id: 'send_email',          label: 'Send Email',       icon: Mail,           requires: 'either' },
  generate_letter:     { id: 'generate_letter',     label: 'Generate Letter',  icon: FileSignature,  permission: 'manage_matters', requires: 'matter' },
  create_reminder:     { id: 'create_reminder',     label: 'Create Reminder',  icon: BellPlus,       requires: 'either' },
  run_conflict_search: { id: 'run_conflict_search', label: 'Run Conflict Search', icon: Search,      permission: 'run_conflict_check', requires: 'either' },
  record_decision:     { id: 'record_decision',     label: 'Record Decision',  icon: Gavel,          permission: 'approve_conflict_waiver', requires: 'either' },
  record_payment:      { id: 'record_payment',      label: 'Record Payment',   icon: Receipt,        permission: 'manage_billing', requires: 'matter' },
  notify_client:       { id: 'notify_client',       label: 'Notify Client',    icon: Mail,           requires: 'either' },
}

/** Available everywhere, on every stage of both pipelines. */
export const UNIVERSAL_ACTIONS: WorkActionId[] = [
  'assign_task', 'schedule_meeting', 'upload_document', 'record_note', 'create_reminder',
]

/**
 * Extra actions that only make sense at a given stage, keyed by lifecycle key.
 * Covers both the intake pipeline (received…retention) and the matter
 * lifecycle (lead…closed); the two never share a key, so one map serves both.
 */
export const STAGE_ACTIONS: Record<string, WorkActionId[]> = {
  // -- Intake pipeline --
  received:               ['run_conflict_search'],
  conflict_check:         ['run_conflict_search', 'record_decision'],
  problem_identification: ['estimate_costs'],
  client_instruction:     ['send_email'],
  legal_opinion:          ['generate_letter', 'send_email'],
  retention:              ['generate_letter', 'record_payment'],

  // -- Matter lifecycle --
  lead:              ['send_email'],
  engagement_letter: ['generate_letter', 'send_email'],
  retainer_pending:  ['record_payment', 'estimate_costs', 'notify_client'],
  open:              ['log_service', 'estimate_costs', 'generate_letter'],
  closed:            [],
}

/**
 * The actions to render for a stage: universal set plus the stage's own,
 * de-duplicated, then filtered by what this context and user can actually do.
 * Order is stage-specific first — the reason you're on this screen leads.
 */
export function actionsForStage(
  stageKey: string | null | undefined,
  ctx: WorkContext,
  permissions: string[],
): WorkActionDef[] {
  const stageSpecific = (stageKey && STAGE_ACTIONS[stageKey]) || []
  const ordered = [...stageSpecific, ...UNIVERSAL_ACTIONS.filter(a => !stageSpecific.includes(a))]

  return ordered
    .map(id => WORK_ACTIONS[id])
    .filter(Boolean)
    .filter(def => {
      if (def.permission && !permissions.includes(def.permission)) return false
      if (def.requires === 'matter' && !ctx.matterId) return false
      if (def.requires === 'submission' && !ctx.submissionId) return false
      if (def.requires === 'either' && !hasTarget(ctx)) return false
      return true
    })
}

// ============================================================
// STAGE COMPLETION GATES
// ============================================================
// What must be true before a stage may be left. Declared as data so a stage's
// requirements can be read, displayed and later moved into pipeline_stages
// without touching the components that enforce them.

export interface StageGate {
  id: string
  label: string
  /**
   * Where the fact comes from. 'live' gates are computed fresh from their own
   * table (conflict_checks) every time. 'assignment_completion' gates have no
   * dedicated column anywhere to check, so they're satisfied by finishing the
   * work itself: approving the assignment tagged with this stage records it
   * in stage_completions (see src/lib/workflowCompletion.ts), never by
   * guessing from a document's title or type.
   */
  source: 'live' | 'assignment_completion'
}

export const STAGE_GATES: Record<string, StageGate[]> = {
  conflict_check: [
    { id: 'conflict_search_run', label: 'Conflict search completed', source: 'live' },
    { id: 'conflict_decision_recorded', label: 'Decision recorded', source: 'live' },
  ],
  engagement_letter: [
    { id: 'engagement_letter_present', label: 'Letter generated or uploaded', source: 'assignment_completion' },
  ],
  retainer_pending: [
    { id: 'retainer_received', label: 'Retainer received', source: 'assignment_completion' },
  ],
}

/** Facts a caller supplies so gates can be evaluated without querying here. */
export interface GateFacts {
  conflict_search_run?: boolean
  conflict_decision_recorded?: boolean
  engagement_letter_present?: boolean
  retainer_received?: boolean
}

export interface GateResult {
  gate: StageGate
  met: boolean
}

/** Evaluate every gate on a stage. An unlisted stage has no gates, so it passes. */
export function evaluateGates(stageKey: string | null | undefined, facts: GateFacts): GateResult[] {
  const gates = (stageKey && STAGE_GATES[stageKey]) || []
  return gates.map(gate => ({ gate, met: Boolean(facts[gate.id as keyof GateFacts]) }))
}

/** True when nothing blocks leaving this stage. */
export function gatesSatisfied(stageKey: string | null | undefined, facts: GateFacts): boolean {
  return evaluateGates(stageKey, facts).every(r => r.met)
}

/**
 * Whether this user may push past an unmet gate. Overriding is deliberately a
 * distinct permission from advancing normally, and the caller is expected to
 * write an audit entry when it's used.
 */
export function canOverrideGates(permissions: string[]): boolean {
  return permissions.includes('override_stage_gates') || permissions.includes('manage_settings')
}
