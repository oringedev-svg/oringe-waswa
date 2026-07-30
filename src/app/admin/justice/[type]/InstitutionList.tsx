'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import type { Institution, InstitutionType } from '@/lib/justice/types'
import { PageHeader, DataTable, EmptyState, SearchInput, type Column } from '@/components/admin/ui'

export default function InstitutionList({
  type, slug, title, zoneHex, rows, counties, subCategories, source, note,
}: {
  type: InstitutionType
  slug: string
  title: string
  zoneHex: string
  rows: Institution[]
  counties: string[]
  subCategories: string[]
  source: string
  note?: string
}) {
  const [query, setQuery] = useState('')
  const [county, setCounty] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [showSource, setShowSource] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (county && r.county !== county) return false
      if (subCategory && r.subCategory !== subCategory) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.county ?? '').toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, query, county, subCategory])

  const columns: Column<Institution>[] = [
    {
      label: 'Name',
      render: r => (
        <Link href={`/admin/justice/${slug}/${r.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      label: 'Class',
      secondary: true,
      render: r => r.subCategory || <span className="opacity-50">Not stated</span>,
    },
    {
      label: 'County',
      render: r => r.county || <span className="opacity-50">Not stated</span>,
    },
    {
      label: 'Location',
      secondary: true,
      render: r => r.location || <span className="opacity-50">Not stated</span>,
    },
    {
      label: 'Phone',
      secondary: true,
      render: r => r.phone
        ? <a href={`tel:${r.phone}`} className="font-mono text-xs hover:underline">{r.phone}</a>
        : <span className="opacity-50">None</span>,
    },
  ]

  // Prisons carry a registered-voter figure and nothing else numeric. It is
  // shown only on that register, and only under its real name.
  if (type === 'prison') {
    columns.splice(4, 0, {
      label: 'Registered voters (2022)',
      secondary: true,
      className: 'tabular-nums text-right',
      render: r => {
        const v = (r as Institution & { registeredVoters?: number | null }).registeredVoters
        return typeof v === 'number' ? v.toLocaleString() : <span className="opacity-50">Not stated</span>
      },
    })
  }

  return (
    <div>
      <PageHeader
        icon={Building2}
        eyebrow="Justice Directory"
        title={title}
        meta={[`${filtered.length} of ${rows.length}`, county || null, subCategory || null]}
        actions={
          <Link href="/admin/justice" className="btn btn-outline text-sm">All registers</Link>
        }
      >
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, county or town" className="max-w-sm" />
        {counties.length > 0 && (
          <select className="input !w-auto text-sm" value={county} onChange={e => setCounty(e.target.value)} aria-label="Filter by county">
            <option value="">All counties</option>
            {counties.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {subCategories.length > 0 && (
          <select className="input !w-auto max-w-[16rem] text-sm" value={subCategory} onChange={e => setSubCategory(e.target.value)} aria-label="Filter by class">
            <option value="">All classes</option>
            {subCategories.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </PageHeader>

      {/* Provenance is collapsed by default so it never competes with the
          register, but it stays one click away because these numbers get
          quoted to clients. */}
      <div className="card mb-4 border-l-[3px]" style={{ borderLeftColor: zoneHex }}>
        <button
          onClick={() => setShowSource(v => !v)}
          aria-expanded={showSource}
          className="w-full text-left px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Where this data comes from
        </button>
        {showSource && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed"><strong>Source:</strong> {source}</p>
            {note && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{note}</p>}
          </div>
        )}
      </div>

      <DataTable
        caption={title}
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        empty={
          <EmptyState
            title={`No ${title.toLowerCase()} match those filters`}
            description="Clear the search, or choose a different county or class."
          />
        }
      />
    </div>
  )
}
