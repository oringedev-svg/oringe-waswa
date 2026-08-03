import type { ElementType, ReactNode } from 'react'

// Every admin page opened with its own hand-rolled title block (39 of them,
// each with slightly different margins, type sizes and description colours).
// This is that block, once. The eyebrow carries the domain/context so the
// h1 can stay short, and `meta` takes the "12 courts available" line that
// pages were previously folding into the description sentence.
export default function PageHeader({
  title, description, eyebrow, icon: Icon, meta, actions, children,
}: {
  title: string
  description?: ReactNode
  eyebrow?: string
  icon?: ElementType
  /** Short factual counts, rendered as a dot-separated row under the title. */
  meta?: (string | null | undefined | false)[]
  actions?: ReactNode
  /** Filter/search row. Sits below the title, above the divider. */
  children?: ReactNode
}) {
  const metaItems = (meta || []).filter(Boolean) as string[]

  return (
    <header className="mb-6 pb-5 border-b border-[var(--color-border)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <div className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)] mb-1.5">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="w-5 h-5 flex-shrink-0 text-[var(--color-text-muted)]" />}
            <h1 className="font-display text-[1.75rem] font-normal text-[var(--color-text-primary)] tracking-tight truncate">{title}</h1>
          </div>
          {description && (
            <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-2xl">{description}</p>
          )}
          {metaItems.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-muted)] flex-wrap">
              {metaItems.map((m, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="opacity-40">·</span>}
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>}
      </div>
      {children && <div className="flex gap-2 flex-wrap mt-4">{children}</div>}
    </header>
  )
}
