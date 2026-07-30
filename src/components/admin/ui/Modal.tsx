'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

// 26 admin pages each rolled their own `fixed inset-0 bg-black/50` dialog.
// Most closed on backdrop click, none closed on Escape, none restored body
// scroll, and none moved focus, so a keyboard user landed behind the
// overlay. This is that dialog once, with those three fixed.
export default function Modal({
  open, onClose, title, description, size = 'md', footer, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: keyof typeof WIDTHS
  /** Action row pinned to the bottom of the dialog. */
  footer?: ReactNode
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Without this the page behind the overlay scrolls under the dialog.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // The backdrop deliberately skips .animate-fade-in: that token is 0.5s,
    // tuned for marketing sections, and reads as lag on a dialog.
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${WIDTHS[size]} my-8 outline-none border border-[var(--color-border)] animate-slide-down`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] truncate">{title}</h2>
            {description && <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2 !px-2 flex-shrink-0" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">{children}</div>

        {footer && (
          <div className="flex gap-3 px-6 py-4 border-t border-[var(--color-border)]">{footer}</div>
        )}
      </div>
    </div>
  )
}
