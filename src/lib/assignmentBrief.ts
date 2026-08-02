import { stageLabel as matterStageLabel } from '@/lib/matterLifecycle'
import { intakeStageMeta } from '@/lib/intakeLifecycle'

// ============================================================
// ASSIGNMENT BRIEF
// ============================================================
// What the assignee needs to understand before they can start: why this
// work exists, where it sits in the matter's life, and what "done" looks
// like. Everything here is derived from data the system already has, the
// assigner only ever supplies the one free-text field (instructions);
// asking them to also restate the matter's own background would just be
// the same duplication this whole task is about removing, in miniature.

export interface AssignmentBrief {
  objective: string
  background: string
  currentStage: string
  expectedDeliverable: string
  instructions: string | null
}

export function buildAssignmentBrief(args: {
  stageKey: string | null
  isMatter: boolean
  matterTitle?: string | null
  matterDescription?: string | null
  clientName?: string | null
  activityTypeName?: string | null
  activityTypeDescription?: string | null
  instructions: string | null
}): AssignmentBrief {
  const stageLabel = args.stageKey
    ? (args.isMatter ? matterStageLabel(args.stageKey) : intakeStageMeta(args.stageKey).label)
    : 'General'

  const objective = args.activityTypeName
    ? args.activityTypeName
    : args.stageKey
      ? `Complete the "${stageLabel}" step${args.clientName ? ` for ${args.clientName}` : ''}`
      : `Work on ${args.matterTitle || (args.clientName ? `${args.clientName}'s enquiry` : 'this matter')}`

  const background = args.activityTypeDescription
    || args.matterDescription
    || (args.clientName ? `No background notes recorded yet for ${args.clientName}.` : 'No background notes recorded yet.')

  const expectedDeliverable = args.activityTypeDescription
    ? 'As described above, attach the resulting document or record the outcome when submitting.'
    : args.isMatter
      ? 'A document or update reflecting the work completed, attached to this assignment before submitting.'
      : 'A written note recording what was found or decided at this step.'

  return {
    objective,
    background,
    currentStage: stageLabel,
    expectedDeliverable,
    instructions: args.instructions,
  }
}
