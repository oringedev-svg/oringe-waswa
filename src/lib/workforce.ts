// ============================================================
// ORGANIZATION & WORKFORCE ENGINE, shared helpers
// ============================================================
// Expiry urgency is a derived value computed at render time, the same
// convention as daysRemaining() in src/lib/serviceOfProcess.ts, no
// cron/notification infra exists in this codebase (the only scheduled job
// anywhere is the unrelated blog auto-publish cron), so a document or
// authority's "days until expiry" is always computed fresh, never stored
// or scheduled.

/** Whole days remaining until date, negative once past. */
export function daysUntilExpiry(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export type ExpiryUrgency = 'ok' | 'due_soon' | 'urgent' | 'critical' | 'expired'

/** Maps days-remaining onto the 90/60/30/14/7-day tiers from the spec, as
 * a badge urgency rather than a scheduled reminder. */
export function expiryUrgency(daysLeft: number): ExpiryUrgency {
  if (daysLeft < 0) return 'expired'
  if (daysLeft <= 7) return 'critical'
  if (daysLeft <= 30) return 'urgent'
  if (daysLeft <= 90) return 'due_soon'
  return 'ok'
}

export const EXPIRY_URGENCY_BADGE: Record<ExpiryUrgency, string> = {
  ok: 'status-active',
  due_soon: 'status-review',
  urgent: 'status-pending',
  critical: 'status-rejected',
  expired: 'status-rejected',
}

export const EXPIRY_URGENCY_LABEL: Record<ExpiryUrgency, string> = {
  ok: 'Valid',
  due_soon: 'Renewal due soon',
  urgent: 'Renewal due',
  critical: 'Renewal urgent',
  expired: 'Expired',
}

export const DOCUMENT_STATUSES = [
  'not_required', 'required', 'pending', 'uploaded', 'under_review', 'approved', 'rejected', 'expired', 'renewal_due',
] as const

export const DOCUMENT_STATUS_META: Record<string, { label: string; badge: string }> = {
  not_required: { label: 'Not Required', badge: 'status-review' },
  required: { label: 'Required', badge: 'status-pending' },
  pending: { label: 'Pending', badge: 'status-pending' },
  uploaded: { label: 'Uploaded', badge: 'status-review' },
  under_review: { label: 'Under Review', badge: 'status-review' },
  approved: { label: 'Approved', badge: 'status-active' },
  rejected: { label: 'Rejected', badge: 'status-rejected' },
  expired: { label: 'Expired', badge: 'status-rejected' },
  renewal_due: { label: 'Renewal Due', badge: 'status-pending' },
}

export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'terminated', 'alumni'] as const

export const EMPLOYMENT_STATUS_META: Record<string, { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'status-active' },
  on_leave: { label: 'On Leave', badge: 'status-review' },
  suspended: { label: 'Suspended', badge: 'status-pending' },
  terminated: { label: 'Terminated', badge: 'status-rejected' },
  alumni: { label: 'Alumni', badge: 'status-review' },
}

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-Time' },
  { value: 'part_time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'retainer', label: 'Retainer' },
]

export const AUTHORITY_STATUSES = ['active', 'expired', 'suspended', 'pending'] as const

export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]
