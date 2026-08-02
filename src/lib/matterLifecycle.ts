// ============================================================
// MATTER LIFECYCLE
// ============================================================
// Lead -> Conflict Check -> Engagement Letter -> Retainer Pending -> Open
// -> On Hold / Closed -> Archived. "Declined" is reachable wherever a
// conflict or a client's non-response ends the instruction before it
// becomes a live matter.
//
// Mirrors the shape of src/lib/editorialWorkflow.ts (the blog editorial
// workflow) deliberately, same pattern, proven in production, applied to
// a different lifecycle rather than inventing a new one.

export type MatterStage =
  | 'lead'
  | 'conflict_check'
  | 'engagement_letter'
  | 'retainer_pending'
  | 'open'
  | 'on_hold'
  | 'closed'
  | 'archived'
  | 'declined'

export interface StageMeta {
  key: MatterStage
  label: string
  color: string
}

export const STAGES: StageMeta[] = [
  { key: 'lead', label: 'Lead', color: 'gray' },
  { key: 'conflict_check', label: 'Conflict Check', color: 'amber' },
  { key: 'engagement_letter', label: 'Engagement Letter', color: 'blue' },
  { key: 'retainer_pending', label: 'Retainer Pending', color: 'purple' },
  { key: 'open', label: 'Open', color: 'green' },
  { key: 'on_hold', label: 'On Hold', color: 'amber' },
  { key: 'closed', label: 'Closed', color: 'gray' },
  { key: 'declined', label: 'Declined', color: 'red' },
  { key: 'archived', label: 'Archived', color: 'red' },
]

// The ordered "happy path", used to render the pipeline stepper and by the
// workflow completion engine to know what "the next stage" means for
// auto-advance. on_hold pauses within "open" rather than getting its own
// position; declined/archived are off-path terminal states.
export const MATTER_HAPPY_PATH: MatterStage[] = ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending', 'open', 'closed']

/** The stage after `stage` on the happy path, or null at the end of it. */
export function nextHappyStage(stage: MatterStage): MatterStage | null {
  const i = MATTER_HAPPY_PATH.indexOf(stage)
  if (i === -1 || i === MATTER_HAPPY_PATH.length - 1) return null
  return MATTER_HAPPY_PATH[i + 1]
}

// Which stages a matter can move to from its current stage.
const TRANSITIONS: Record<MatterStage, MatterStage[]> = {
  lead: ['conflict_check', 'declined', 'archived'],
  conflict_check: ['engagement_letter', 'declined', 'lead', 'archived'],
  // Direct conflict_check -> open covers pro bono / no-retainer matters that
  // skip a formal engagement letter and retainer stage.
  engagement_letter: ['retainer_pending', 'open', 'declined', 'archived'],
  retainer_pending: ['open', 'archived'],
  open: ['on_hold', 'closed', 'archived'],
  on_hold: ['open', 'closed', 'archived'],
  closed: ['open', 'archived'],
  declined: ['archived'],
  archived: ['lead'],
}

// The permission required to make a given transition, keyed by "from:to".
// Only transitions that need one are listed, anything else just needs the
// base manage_matters permission. Moving past the conflict-check stage is
// the mandatory partner sign-off point.
const STAGE_PERMISSION: Record<string, string> = {
  'lead:conflict_check': 'run_conflict_check',
  'conflict_check:engagement_letter': 'approve_conflict_waiver',
  'conflict_check:declined': 'approve_conflict_waiver',
}

export function canTransition(from: MatterStage, to: MatterStage): boolean {
  if (from === to) return false
  return (TRANSITIONS[from] || []).includes(to)
}

export function availableTransitions(from: MatterStage): MatterStage[] {
  return TRANSITIONS[from] || []
}

export function stagePermission(from: MatterStage, to: MatterStage): string {
  return STAGE_PERMISSION[`${from}:${to}`] || 'manage_matters'
}

// Common tasks an advocate actually assigns at each stage, offered as
// a dropdown of milestone-related suggestions rather than a blank text
// field, with room to type something else when none fit.
const STAGE_TASK_SUGGESTIONS: Record<string, string[]> = {
  lead: [
    'Verify client identity (KYC/AML)',
    'Request supporting documents from client',
    'Confirm scope of instruction',
    'Schedule initial consultation',
  ],
  conflict_check: [
    'Run additional conflict search',
    'Escalate to partner for waiver decision',
    'Document basis for conflict clearance',
  ],
  engagement_letter: [
    'Draft engagement letter',
    'Send engagement letter for signature',
    'Follow up on unsigned engagement letter',
    'Confirm fee arrangement with client',
  ],
  retainer_pending: [
    'Send retainer invoice',
    'Follow up on retainer payment',
    'Confirm receipt of retainer into client account',
  ],
  open: [
    'Open physical/e-file',
    'Draft pleadings/instrument',
    'File pleadings',
    'Serve process on opposing party',
    'Prepare for court mention/hearing',
    'Request further instructions from client',
    'Prepare status update for client',
  ],
  on_hold: [
    'Follow up with client on hold status',
    'Review file for reactivation',
  ],
  closed: [
    'Prepare closing letter',
    'Final billing/invoice',
    'Archive file',
  ],
}

export function stageTaskSuggestions(stage: string): string[] {
  return STAGE_TASK_SUGGESTIONS[stage] || []
}

export function stageLabel(stage: string): string {
  return stageMeta(stage).label
}

export function stageMeta(stage: string): StageMeta {
  return STAGES.find((s) => s.key === stage) || { key: stage as MatterStage, label: stage, color: 'gray' }
}
