'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { INSTITUTION_LABELS, type InstitutionType } from '@/lib/justice/types'
import { JUSTICE_ZONES } from '@/lib/justice/zones'
import { SearchInput } from '@/components/admin/ui'

interface Row {
  id: string
  name: string
  institutionType: InstitutionType
  subCategory: string | null
  county: string | null
  location: string | null
}

export default function JusticeSearch() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setRows([]); return }
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`/api/justice/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => setRows(d.results ?? []))
        .catch(() => setRows([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search every register at once, by name, county or town"
        className="max-w-xl"
      />

      {query.trim() && (
        <div className="card mt-3 overflow-hidden">
          {searching && rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] p-4">Searching...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] p-4">
              Nothing matches &ldquo;{query}&rdquo; in any register.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {rows.map(row => {
                const zone = JUSTICE_ZONES[row.institutionType]
                const label = INSTITUTION_LABELS[row.institutionType]
                return (
                  <li key={row.id}>
                    <Link
                      href={`${label.href}/${row.id}`}
                      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-[var(--color-surface-overlay)] transition-colors border-l-[3px]"
                      style={{ borderLeftColor: zone.hex }}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--color-text-primary)] truncate">{row.name}</span>
                        <span className="block text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                          {[row.subCategory, row.county, row.location].filter(Boolean).join(' · ') || 'No location on file'}
                        </span>
                      </span>
                      {/* The type is carried by colour and stated in words.
                          No icon: it would be a third encoding of the same
                          fact in a row that is already dense. */}
                      <span
                        className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] flex-shrink-0 mt-0.5"
                        style={{ color: zone.hex }}
                      >
                        {label.singular}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
