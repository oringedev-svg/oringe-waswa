// ============================================================
// INTAKE PIPELINE (pre-matter)
// ============================================================
// Client Request -> Conflict Check -> Problem Identification -> Client
// Instruction -> Legal Opinion -> Retention -> Promoted to Matter.
// "Declined" is reachable from any point where the enquiry ends before
// becoming a matter. Mirrors matterLifecycle.ts's shape deliberately, the
// matter's own lifecycle continues immediately where this one ends, so the
// two read as one continuous pipeline rather than two separate trackers.

export type IntakeStage =
  | 'received'
  | 'conflict_check'
  | 'problem_identification'
  | 'client_instruction'
  | 'legal_opinion'
  | 'retention'
  | 'promoted'
  | 'declined'

export interface IntakeStageMeta {
  key: IntakeStage
  label: string
  description: string
}

export const INTAKE_STAGES: IntakeStageMeta[] = [
  { key: 'received', label: 'Client Request', description: 'The enquiry as it arrived' },
  { key: 'conflict_check', label: 'Conflict Check', description: 'Search for conflicts before anything else happens' },
  { key: 'problem_identification', label: 'Problem Identification', description: 'What the client actually needs, in the firm’s own words' },
  { key: 'client_instruction', label: 'Client Instruction', description: 'What the client has asked the firm to do' },
  { key: 'legal_opinion', label: 'Legal Opinion', description: 'The advice given in response to the instruction' },
  { key: 'retention', label: 'Retention', description: 'The client retains the firm to act' },
  { key: 'promoted', label: 'Promoted to Matter', description: 'A matter now carries this forward' },
  { key: 'declined', label: 'Declined', description: 'The enquiry ends here' },
]

// The ordered "happy path", used to render the pipeline and to know which
// steps are behind, current, or ahead of a given stage.
export const INTAKE_HAPPY_PATH: IntakeStage[] = [
  'received', 'conflict_check', 'problem_identification', 'client_instruction', 'legal_opinion', 'retention', 'promoted',
]

const TRANSITIONS: Record<IntakeStage, IntakeStage[]> = {
  received: ['conflict_check', 'declined'],
  conflict_check: ['problem_identification', 'declined', 'received'],
  problem_identification: ['client_instruction', 'declined'],
  client_instruction: ['legal_opinion', 'declined'],
  legal_opinion: ['retention', 'declined'],
  retention: ['promoted', 'declined'],
  promoted: [],
  declined: [],
}

// Only the conflict-check step needs a specific permission (the same one
// the matter's own conflict check requires); everything else just needs
// the base submissions-management permission already in use.
const STAGE_PERMISSION: Record<string, string> = {
  'received:conflict_check': 'run_conflict_check',
}

export function canTransitionIntake(from: IntakeStage, to: IntakeStage): boolean {
  if (from === to) return false
  return (TRANSITIONS[from] || []).includes(to)
}

export function availableIntakeTransitions(from: IntakeStage): IntakeStage[] {
  return TRANSITIONS[from] || []
}

export function intakeStagePermission(from: IntakeStage, to: IntakeStage): string {
  return STAGE_PERMISSION[`${from}:${to}`] || 'manage_forms'
}

export function intakeStageMeta(stage: string | null | undefined): IntakeStageMeta {
  return INTAKE_STAGES.find((s) => s.key === stage) || INTAKE_STAGES[0]
}
