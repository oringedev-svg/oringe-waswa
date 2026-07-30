import type { ElementType, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

// 42 pages hand-rolled the same centred spinner and ~30 hand-rolled an
// empty state, each picking its own padding and muted-text variable. Both
// live here so a slow page and an empty page look deliberate rather than
// broken.

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3" role="status" aria-live="polite">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
      {label && <p className="text-sm text-[var(--color-text-muted)]">{label}</p>}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon?: ElementType
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="card p-12 text-center">
      {Icon && <Icon className="w-7 h-7 mx-auto mb-3 text-[var(--color-text-muted)] opacity-60" />}
      <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  )
}

// Shown when a page's backing table doesn't exist yet. Distinct from an
// empty state on purpose: nothing the user does in the UI will fix it, so
// it names the migration instead of offering a "create one" button.
export function SetupRequired({
  icon, title, migration, children,
}: {
  icon?: ElementType
  title: string
  migration?: string
  children?: ReactNode
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={
        <>
          {children}
          {migration && (
            <>
              {' '}Run <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">{migration}</code> in the Supabase SQL editor.
            </>
          )}
        </>
      }
    />
  )
}
