'use client'
import Link from 'next/link'
import { Clock, AlertCircle, CheckCircle2, User, ArrowRight, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import StatusPill, { type Tone } from '@/components/admin/ui/StatusPill'

interface AssignmentCardProps {
  id: string
  title?: string
  matterNumber?: string
  matterTitle?: string
  assignedBy?: string
  assignedTo?: string
  status: string
  submittedAt?: string | null
  dueDate?: string | null
  isGridView?: boolean
}

// Was a map of raw light-mode Tailwind classes (`bg-blue-100 text-blue-800
// border-blue-200`) with no dark: variant, so every one of these badges
// rendered dark text on a near-white chip in dark mode. Routed through the
// shared tones, which resolve from --status-* and are theme-aware.
const STATUS_CONFIG: Record<string, { tone: Tone; label: string; icon: React.ReactNode }> = {
  Assigned: { tone: 'done', label: 'Assigned', icon: <Clock className="w-3 h-3" /> },
  Accepted: { tone: 'done', label: 'Accepted', icon: <Clock className="w-3 h-3" /> },
  'In Progress': { tone: 'risk', label: 'In Progress', icon: <AlertCircle className="w-3 h-3" /> },
  Submitted: { tone: 'review', label: 'Pending Review', icon: <Clock className="w-3 h-3" /> },
  Approved: { tone: 'safe', label: 'Approved', icon: <CheckCircle2 className="w-3 h-3" /> },
  Rejected: { tone: 'overdue', label: 'Rejected', icon: <AlertCircle className="w-3 h-3" /> },
  Revoked: { tone: 'neutral', label: 'Revoked', icon: <AlertCircle className="w-3 h-3" /> },
  Cancelled: { tone: 'neutral', label: 'Cancelled', icon: <AlertCircle className="w-3 h-3" /> },
}

export default function AssignmentCard({
  id, title, matterNumber, matterTitle, assignedBy, assignedTo, status, submittedAt, dueDate, isGridView,
}: AssignmentCardProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Assigned
  const isOverdue = Boolean(dueDate) && new Date(dueDate!) < new Date() && status !== 'Approved'

  const badges = (
    <>
      <StatusPill tone={config.tone}>
        {config.icon}
        {config.label}
      </StatusPill>
      {/* Previously only rendered in list view, so the same assignment
          looked on-time in grid view and overdue in list view. */}
      {isOverdue && <StatusPill tone="overdue" dot>Overdue</StatusPill>}
    </>
  )

  // `submittedAt` was accepted as a prop and then never rendered anywhere,
  // so callers passing it got nothing for it.
  const meta = (
    <>
      {assignedTo && (
        <span className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          {assignedTo}
        </span>
      )}
      {dueDate && (
        <span className={`flex items-center gap-1 ${isOverdue ? 'text-[var(--status-danger)] font-medium' : ''}`}>
          <Clock className="w-3.5 h-3.5" />
          Due {formatDate(dueDate, 'short')}
        </span>
      )}
      {submittedAt && (
        <span className="flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />
          Submitted {formatDate(submittedAt, 'short')}
        </span>
      )}
    </>
  )

  if (isGridView) {
    return (
      <Link href={`/admin/assignments/${id}`} className="card p-5 h-full flex flex-col hover:shadow-[var(--shadow-md)] transition-shadow group">
        <div className="flex flex-wrap gap-1.5 mb-3">{badges}</div>
        <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2 flex-1">{title || 'Untitled'}</h3>
        {matterTitle && (
          <div className="text-sm text-[var(--color-text-muted)] mt-2 line-clamp-1">
            <span className="font-mono text-xs">{matterNumber}</span> {matterTitle}
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="truncate">{assignedTo || assignedBy || 'Unassigned'}</span>
          <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/admin/assignments/${id}`}
      className="card flex items-start justify-between gap-4 p-4 hover:shadow-[var(--shadow-md)] transition-shadow group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">{badges}</div>
        <h3 className="font-medium text-[var(--color-text-primary)] truncate">{title || 'Untitled'}</h3>
        {matterTitle && (
          <div className="text-sm text-[var(--color-text-muted)] mt-1 truncate">
            <span className="font-mono text-xs">{matterNumber}</span> {matterTitle}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2.5 text-xs text-[var(--color-text-muted)] flex-wrap">{meta}</div>
      </div>
      <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
    </Link>
  )
}
