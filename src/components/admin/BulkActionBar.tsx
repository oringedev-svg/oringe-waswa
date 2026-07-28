'use client'
import { X } from 'lucide-react'

export interface BulkAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

export default function BulkActionBar({
  count,
  actions,
  onClear,
}: {
  count: number
  actions: BulkAction[]
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 rounded-lg shadow-[var(--shadow-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{count} selected</span>
      <div className="w-px h-5 bg-[var(--color-border)]" />
      <div className="flex gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`btn !py-1.5 !px-3 text-xs ${action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-outline'}`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button onClick={onClear} className="text-[var(--color-muted)] hover:text-[var(--color-text-primary)] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
