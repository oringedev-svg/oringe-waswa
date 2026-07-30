import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateTrackingCode(type: string): string {
  const prefix = {
    job: 'JOB',
    contact: 'CNT',
    volunteer: 'VOL',
    paper: 'PAP',
    appointment: 'APT',
  }[type] || 'SUB'
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'datetime' = 'long') {
  const d = new Date(date)
  const opts: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : format === 'datetime'
      ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
  return new Intl.DateTimeFormat('en-KE', opts).format(d)
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trimEnd() + '…'
}

export function getMatterTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    civil_litigation: 'Civil Litigation',
    criminal_defense: 'Criminal Defense',
    family_law: 'Family Law',
    corporate: 'Corporate Law',
    property: 'Property Law',
    immigration: 'Immigration',
    employment: 'Employment Law',
    intellectual_property: 'Intellectual Property',
    constitutional: 'Constitutional Law',
    alternative_dispute: 'Alternative Dispute Resolution',
    other: 'Other',
  }
  return labels[type] || type
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'status-pending',
    under_review: 'status-review',
    interview_scheduled: 'status-review',
    accepted: 'status-active',
    completed: 'status-completed',
    rejected: 'status-rejected',
    on_hold: 'status-pending',
    awaiting_info: 'status-pending',
    confirmed: 'status-active',
    cancelled: 'status-rejected',
    no_show: 'status-rejected',
    active: 'status-active',
    closed: 'status-completed',
    open: 'status-active',
    draft: 'status-pending',
    ready_for_review: 'status-review',
    approved: 'status-active',
    scheduled: 'status-review',
    changes_requested: 'status-rejected',
    published: 'status-active',
    archived: 'status-completed',
    upcoming: 'status-active',
    past: 'status-completed',
    lead: 'status-pending',
    conflict_check: 'status-review',
    engagement_letter: 'status-review',
    retainer_pending: 'status-review',
    declined: 'status-rejected',
    new: 'status-pending',
    reviewing: 'status-review',
    shortlisted: 'status-active',
    hired: 'status-completed',
  }
  return colors[status] || 'status-pending'
}

export function generateMatterNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `OW-${year}-${rand}`
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${year}-${rand}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0)
}

/** 90 -> "1h 30m", 45 -> "45m" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const MATTER_TYPES = [
  { value: 'civil_litigation', label: 'Civil Litigation' },
  { value: 'debt_recovery', label: 'Debt Recovery' },
  { value: 'criminal_defense', label: 'Criminal Defense' },
  { value: 'family_law', label: 'Family Law' },
  { value: 'corporate', label: 'Corporate Law' },
  { value: 'property', label: 'Property Law' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'employment', label: 'Employment Law' },
  { value: 'intellectual_property', label: 'Intellectual Property' },
  { value: 'constitutional', label: 'Constitutional Law' },
  { value: 'alternative_dispute', label: 'Alternative Dispute Resolution' },
  { value: 'other', label: 'Other' },
]

export const DOCUMENT_TYPES = [
  { value: 'pleading', label: 'Pleading' },
  { value: 'motion', label: 'Motion' },
  { value: 'brief', label: 'Brief' },
  { value: 'contract', label: 'Contract' },
  { value: 'demand_letter', label: 'Demand Letter' },
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'exhibit', label: 'Exhibit' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'court_order', label: 'Court Order' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'invoice', label: 'Invoice / Billing' },
  { value: 'memo', label: 'Internal Memo' },
  { value: 'research', label: 'Legal Research' },
  { value: 'other', label: 'Other' },
]
