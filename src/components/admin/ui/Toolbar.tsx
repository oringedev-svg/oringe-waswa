'use client'
import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'

// The search + filter row that sits under almost every list page. Pulled
// out mainly so the search field stops being a bare `.input` with no
// affordance: it now carries a leading icon and a clear button, which is
// what made "why is this list empty" hard to answer on the old pages.
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 flex-wrap items-center">{children}</div>
}

export function SearchInput({
  value, onChange, placeholder = 'Search…', className = 'max-w-xs',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
      <input
        className="input text-sm !pl-9 !pr-8"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// A segmented control for the 2-5 option filters pages were spending a
// whole <select> on. Showing the options makes the current filter legible
// at a glance, which a collapsed select never is.
export function FilterTabs<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[var(--radius-md)] bg-[var(--color-surface-overlay)]">
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={[
              'px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap',
              active
                ? 'bg-[var(--color-brand)] text-white shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span className="ml-1.5 opacity-60 tabular-nums">{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
