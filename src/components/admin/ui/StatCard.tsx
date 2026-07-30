import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowRight } from 'lucide-react'
import { SECTION_COLORS, type SectionColor } from '@/lib/sectionColors'

// A single number worth acting on. The rule this enforces: a stat is only
// worth a card if there is somewhere to go when it looks wrong, so `href`
// is part of the shape rather than optional decoration.
export default function StatCard({
  label, value, hint, href, icon: Icon, color = 'slate', emphasis = false,
}: {
  label: string
  value: string | number
  hint?: string
  href?: string
  icon?: ElementType
  color?: SectionColor
  /** Draws the value in the section colour. Reserve for the one number
      on the page that should pull the eye first. */
  emphasis?: boolean
}) {
  const hex = SECTION_COLORS[color]

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">
          {label}
        </div>
        {Icon && <Icon className="w-4 h-4 flex-shrink-0 opacity-70" style={{ color: hex }} />}
      </div>
      <div
        className="font-display text-3xl font-semibold mt-2 tabular-nums leading-none"
        style={{ color: emphasis ? hex : 'var(--color-text-primary)' }}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-[var(--color-text-muted)] mt-2">{hint}</div>}
      {href && (
        <div className="flex items-center gap-1 text-xs mt-3 font-medium" style={{ color: hex }}>
          Open <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </>
  )

  const className = 'card p-5 border-l-[3px] block h-full'

  if (href) {
    return (
      <Link href={href} className={`${className} hover:shadow-[var(--shadow-md)] transition-shadow`} style={{ borderLeftColor: hex }}>
        {body}
      </Link>
    )
  }
  return <div className={className} style={{ borderLeftColor: hex }}>{body}</div>
}
