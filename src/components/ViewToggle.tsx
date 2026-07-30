'use client'
import { LayoutList, LayoutGrid } from 'lucide-react'

interface ViewToggleProps {
  isGridView: boolean
  onToggle: (isGrid: boolean) => void
  className?: string
}

export default function ViewToggle({ isGridView, onToggle, className = '' }: ViewToggleProps) {
  return (
    <div className={`flex gap-1.5 bg-[var(--color-surface-overlay)] rounded-lg p-1 ${className}`}>
      <button
        onClick={() => onToggle(false)}
        className={`p-1.5 rounded transition-colors ${!isGridView ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text-primary)]'}`}
        title="List view"
        aria-label="Switch to list view"
      >
        <LayoutList className="w-4 h-4" />
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`p-1.5 rounded transition-colors ${isGridView ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text-primary)]'}`}
        title="Grid view"
        aria-label="Switch to grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )
}
