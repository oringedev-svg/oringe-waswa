'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle, X, BookOpen, ExternalLink } from 'lucide-react'
import { getHelpForPath } from '@/lib/helpContent'

interface HelpWidgetProps {
  /** Where to anchor the floating trigger. Defaults to bottom-left so it
   *  never collides with the AI chat/assistant widgets, which sit
   *  bottom-right on both the public site and the admin portal. */
  position?: 'bottom-left' | 'bottom-right'
  /** Link shown at the foot of the panel to the full manual. Admin gets
   *  the in-app manual; public pages have none. */
  manualHref?: string
}

export default function HelpWidget({ position = 'bottom-left', manualHref }: HelpWidgetProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const topic = getHelpForPath(pathname || '/')

  const posClasses = position === 'bottom-left' ? 'left-6' : 'right-6'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open help"
        className={`fixed bottom-6 ${posClasses} z-50 w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-text-primary)] text-[var(--color-surface)] shadow-[var(--shadow-lg)] hover:scale-105 transition-transform`}
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-[var(--shadow-xl)] flex flex-col animate-slide-down">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[var(--color-border)]">
              <div>
                <p className="eyebrow mb-2">Help</p>
                <h3 className="text-lg font-display font-semibold leading-tight text-[var(--color-text-primary)]">
                  {topic ? topic.title : 'This page'}
                </h3>
              </div>
              <button onClick={() => setOpen(false)} className="btn btn-ghost p-2 !px-2 flex-shrink-0" aria-label="Close help">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {topic ? (
                <>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{topic.summary}</p>
                  {topic.sections.map((section) => (
                    <div key={section.heading}>
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{section.heading}</h4>
                      <div className="space-y-2">
                        {section.body.map((para, i) => (
                          <p key={i} className="text-sm text-[var(--color-text-muted)] leading-relaxed">{para}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                  {topic.tips && topic.tips.length > 0 && (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] mb-2">Tip</p>
                      {topic.tips.map((tip, i) => (
                        <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{tip}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  No specific help is written for this page yet. General navigation and contact details are in the footer.
                </p>
              )}
            </div>

            {manualHref && (
              <div className="p-5 border-t border-[var(--color-border)]">
                <Link href={manualHref} onClick={() => setOpen(false)} className="btn btn-outline w-full">
                  <BookOpen className="w-4 h-4" /> Open full manual <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
