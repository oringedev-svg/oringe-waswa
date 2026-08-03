import type { ReactNode } from 'react'

// The admin was spelling status out in raw Tailwind palette classes
// (`bg-red-100 text-red-800 border-red-200`) inline, per page, so the same
// state could be rose on one screen and orange on the next, and none of it
// tracked the --status-* tokens globals.css already defines. These are the
// firm's five states; everything else is `neutral`.
//
//   overdue  red    - past its date, someone is already late
//   risk     amber  - needs a decision before it becomes overdue
//   safe     green  - on track, nothing owed
//   done     blue   - closed out, no longer actionable
//   review   purple - waiting on somebody else
export type Tone = 'overdue' | 'risk' | 'safe' | 'done' | 'review' | 'neutral'

const TONES: Record<Tone, { fg: string; bg: string }> = {
  overdue: { fg: 'var(--status-danger)', bg: 'rgba(var(--status-danger-rgb), 0.10)' },
  risk: { fg: 'var(--status-warning)', bg: 'rgba(var(--status-warning-rgb), 0.12)' },
  safe: { fg: 'var(--status-success)', bg: 'rgba(var(--status-success-rgb), 0.10)' },
  done: { fg: 'var(--status-info)', bg: 'rgba(var(--status-info-rgb), 0.10)' },
  review: { fg: 'var(--status-review)', bg: 'rgba(var(--status-review-rgb), 0.10)' },
  neutral: { fg: 'var(--color-text-muted)', bg: 'var(--color-surface-overlay)' },
}

export default function StatusPill({
  tone = 'neutral', children, dot = false,
}: {
  tone?: Tone
  children: ReactNode
  /** Adds a leading dot. Use in dense tables where the pill is small. */
  dot?: boolean
}) {
  const t = TONES[tone]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-[0.68rem] font-semibold uppercase tracking-[0.06em] whitespace-nowrap"
      style={{ color: t.fg, background: t.bg }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.fg }} />}
      {children}
    </span>
  )
}
