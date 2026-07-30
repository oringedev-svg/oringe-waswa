'use client'
import type { ReactNode } from 'react'
import { LoadingState, EmptyState } from './States'

export interface Column<T> {
  /** Header label. Also the React key, so keep it unique per table. */
  label: string
  render: (row: T) => ReactNode
  /** Tailwind width/alignment utilities for both the th and its cells. */
  className?: string
  /** Hide below `md`. Use for columns that are context, not identity. */
  secondary?: boolean
}

// 11 admin pages hand-rolled `<table>` with the same thead/tbody classes.
// Beyond dedupe this fixes two things none of them did: the header row now
// sticks while a long list scrolls, and low-value columns collapse on
// mobile instead of forcing a horizontal scroll through empty cells.
export default function DataTable<T>({
  columns, rows, rowKey, onRowClick, loading, empty, caption,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  empty?: ReactNode
  /** Screen-reader description of what the table lists. */
  caption?: string
}) {
  if (loading) return <LoadingState />
  if (!rows.length) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-[var(--color-surface-overlay)] text-left sticky top-14 z-10">
            <tr>
              {columns.map(c => (
                <th
                  key={c.label}
                  scope="col"
                  className={[
                    'px-4 py-3 font-medium text-xs uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap',
                    c.secondary ? 'hidden md:table-cell' : '',
                    c.className || '',
                  ].join(' ')}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'transition-colors hover:bg-[var(--color-surface-overlay)]',
                  onRowClick ? 'cursor-pointer' : '',
                ].join(' ')}
              >
                {columns.map(c => (
                  <td
                    key={c.label}
                    className={[
                      'px-4 py-3 align-middle text-[var(--color-text-secondary)]',
                      c.secondary ? 'hidden md:table-cell' : '',
                      c.className || '',
                    ].join(' ')}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
