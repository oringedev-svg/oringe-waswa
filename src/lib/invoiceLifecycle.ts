// ============================================================
// INVOICE LIFECYCLE
// ============================================================
// Draft -> Sent -> Paid, with Void reachable until payment. A sent invoice
// is immutable, corrections happen by voiding and issuing a new one, which
// releases the underlying time entries back to unbilled.
//
// Same state-machine shape as matterLifecycle.ts / editorialWorkflow.ts.

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

export interface InvoiceStatusMeta {
  key: InvoiceStatus
  label: string
}

export const INVOICE_STATUSES: InvoiceStatusMeta[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'void', label: 'Void' },
]

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
  paid: [],
  void: [],
}

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return false
  return (TRANSITIONS[from] || []).includes(to)
}

export function availableInvoiceTransitions(from: InvoiceStatus): InvoiceStatus[] {
  return TRANSITIONS[from] || []
}

export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUSES.find((s) => s.key === status)?.label || status
}

export const INVOICE_STATUS_BADGE: Record<string, string> = {
  draft: 'status-pending',
  sent: 'status-review',
  paid: 'status-active',
  void: 'status-rejected',
}
