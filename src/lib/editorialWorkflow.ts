// ============================================================
// EDITORIAL APPROVAL WORKFLOW
// ============================================================
// Draft -> Ready for Review -> Approved -> Scheduled -> Published -> Archived
// "Changes Requested" sends a post back to Draft with reviewer comments attached.
// A Published (or Scheduled) post can be pulled back to Draft to be revised, // "Unpublish", which requires the same permission that published it in the
// first place, and takes it off the live site immediately.

export type WorkflowStatus =
  | 'draft'
  | 'ready_for_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'changes_requested'
  | 'archived'

export interface StatusMeta {
  key: WorkflowStatus
  label: string
  color: string // tailwind-ish token used by the badge
}

export const STATUSES: StatusMeta[] = [
  { key: 'draft', label: 'Draft', color: 'gray' },
  { key: 'ready_for_review', label: 'Ready for Review', color: 'blue' },
  { key: 'approved', label: 'Approved', color: 'teal' },
  { key: 'scheduled', label: 'Scheduled', color: 'purple' },
  { key: 'published', label: 'Published', color: 'green' },
  { key: 'changes_requested', label: 'Changes Requested', color: 'amber' },
  { key: 'archived', label: 'Archived', color: 'red' },
]

// Which statuses a post can move to from its current status.
// 'archived' is reachable from anywhere (an admin/moderator override).
const TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  draft: ['ready_for_review', 'archived'],
  ready_for_review: ['approved', 'changes_requested', 'draft', 'archived'],
  approved: ['scheduled', 'published', 'changes_requested', 'archived'],
  scheduled: ['draft', 'published', 'approved', 'archived'],
  published: ['draft', 'archived'],
  changes_requested: ['draft', 'archived'],
  archived: ['draft'],
}

// The permission required to make a given transition, keyed by "from:to".
// Only transitions that need one are listed, anything else just needs the
// base admin/staff/moderator role. Unpublishing (published/scheduled -> draft)
// requires the same permission that published it, since it has the same
// real-world effect on the live site.
const TRANSITION_PERMISSION: Record<string, string> = {
  'ready_for_review:approved': 'approve_articles',
  'ready_for_review:changes_requested': 'approve_articles',
  'approved:scheduled': 'publish_articles',
  'approved:published': 'publish_articles',
  'scheduled:published': 'publish_articles',
  'scheduled:draft': 'publish_articles',
  'published:draft': 'publish_articles',
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (from === to) return false
  return (TRANSITIONS[from] || []).includes(to)
}

export function availableTransitions(from: WorkflowStatus): WorkflowStatus[] {
  return TRANSITIONS[from] || []
}

export function transitionPermission(from: WorkflowStatus, to: WorkflowStatus): string | undefined {
  return TRANSITION_PERMISSION[`${from}:${to}`]
}

// "Unpublish" reads far clearer than "Draft" when it's pulling live content
// down, even though the underlying status is the same 'draft' as every other
// path back to it.
export function transitionLabel(from: WorkflowStatus, to: WorkflowStatus): string {
  if (to === 'draft' && (from === 'published' || from === 'scheduled')) return 'Unpublish'
  return statusMeta(to).label
}

export function statusMeta(status: string): StatusMeta {
  return STATUSES.find((s) => s.key === status) || { key: status as WorkflowStatus, label: status, color: 'gray' }
}
