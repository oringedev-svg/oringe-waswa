'use client'
import { useState, useEffect, type ElementType, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { SECTION_COLORS, type SectionColor } from '@/lib/sectionColors'

// The standard shape for every card/section in the admin going forward: a
// colour-coded left rule + title (so a dense page reads by colour, not as
// one undifferentiated wall of cards) and a collapse toggle (so low-
// frequency sections don't compete for attention by default). Pass
// `defaultOpen` per section rather than always true, most sections should
// start collapsed; open only the ones that drive the page's primary action.
export default function SectionCard({
  title, icon: Icon, color, defaultOpen = false, badge, headerExtra, children, style,
}: {
  title: string
  icon?: ElementType
  color: SectionColor
  defaultOpen?: boolean
  badge?: ReactNode
  headerExtra?: ReactNode
  children: ReactNode
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Sections whose "should this start open" answer depends on data that
  // loads after mount (e.g. "open if something's overdue") can pass a
  // changing defaultOpen; sync it once rather than fighting user toggles.
  useEffect(() => { setOpen(defaultOpen) }, [defaultOpen])
  const hex = SECTION_COLORS[color]

  return (
    <div className="card mb-6 overflow-hidden border-l-[3px]" style={{ borderLeftColor: hex, ...style }}>
      <div className="w-full flex items-center justify-between gap-3 p-6">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 min-w-0 text-left flex-1">
          <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--color-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
          {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: hex }} />}
          <h2 className="font-display font-semibold text-xl truncate" style={{ color: hex }}>{title}</h2>
          {badge}
        </button>
        {headerExtra && <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>{headerExtra}</div>}
      </div>
      {open && <div className="px-6 pb-6 -mt-2">{children}</div>}
    </div>
  )
}
