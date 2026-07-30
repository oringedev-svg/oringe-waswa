'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Archive, ArchiveRestore, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { COURT_TYPES, courtTypeLabel, REGISTRY_TYPES, registryTypeLabel } from '@/lib/litigationStatus'
import {
  PageHeader, Modal, DataTable, StatusPill, SetupRequired, EmptyState,
  Toolbar, SearchInput, FilterTabs, type Column,
} from '@/components/admin/ui'

interface Court {
  id: string
  name: string
  court_type: string
  is_superior: boolean
  station?: string
  county?: string
  physical_address?: string
  notes?: string
  is_active: boolean
  display_order: number
  // Arrives with migration 027. Absent (undefined) on rows fetched before
  // that runs, treated the same as 'unspecified'.
  registry_type?: string
}

export default function AdminCourtsPage() {
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Court> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [missing, setMissing] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    fetch(`/api/courts?${params}`)
      .then(async r => {
        if (!r.ok) { setMissing(true); return [] }
        setMissing(false)
        return r.json()
      })
      .then(d => setCourts(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.name || !editing?.court_type) { toast.error('Name and court type are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/courts', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Court added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Archive this court? Matters already filed there keep their record.')) return
    const res = await fetch(`/api/courts?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Archived'); load() } else toast.error('Failed')
  }

  async function restore(id: string) {
    await fetch('/api/courts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restore: true, is_active: true }),
    })
    toast.success('Restored')
    load()
  }

  const filtered = courts.filter(c => {
    if (typeFilter !== 'all' && c.court_type !== typeFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.station || '').toLowerCase().includes(q) || (c.county || '').toLowerCase().includes(q)
  })

  if (missing) {
    return (
      <SetupRequired icon={Landmark} title="Courts register not set up yet" migration="025_courts_and_litigation.sql">
        The courts register and its seed of Kenyan courts have not been created.
      </SetupRequired>
    )
  }

  const columns: Column<Court>[] = [
    {
      label: 'Court',
      render: c => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5 md:hidden">
            <span className="text-xs text-[var(--color-text-muted)]">{courtTypeLabel(c.court_type)}</span>
            {c.station && <span className="text-xs text-[var(--color-text-muted)] opacity-60">· {c.station}</span>}
          </div>
          {!c.is_active && <StatusPill tone="overdue">Inactive</StatusPill>}
        </div>
      ),
    },
    {
      label: 'Type',
      secondary: true,
      render: c => (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-secondary)]">{courtTypeLabel(c.court_type)}</span>
          {c.is_superior && <StatusPill tone="review">Superior</StatusPill>}
        </div>
      ),
    },
    {
      label: 'Registry',
      secondary: true,
      render: c => (c.registry_type ?? 'unspecified') === 'unspecified'
        ? <span className="text-[var(--color-text-muted)] opacity-50">-</span>
        : <span>{registryTypeLabel(c.registry_type!)}</span>,
    },
    { label: 'Station', secondary: true, render: c => c.station || <span className="opacity-50">-</span> },
    { label: 'County', secondary: true, render: c => c.county || <span className="opacity-50">-</span> },
    {
      label: 'Actions',
      className: 'w-24 text-right',
      render: c => (
        <div className="flex gap-1 justify-end">
          {trash ? (
            <button onClick={() => restore(c.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore">
              <ArchiveRestore className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(c); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit">
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(c.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Archive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Landmark}
        eyebrow="Reference data"
        title="Courts Register"
        description="Matters pick their court from this list, so a case is never filed against a mistyped court name."
        meta={[`${filtered.length} ${trash ? 'archived' : 'available'}`, typeFilter !== 'all' ? courtTypeLabel(typeFilter) : null]}
        actions={!trash && (
          <button
            onClick={() => { setEditing({ court_type: 'magistrate', is_superior: false, is_active: true, display_order: courts.length }); setIsNew(true) }}
            className="btn btn-primary gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Court
          </button>
        )}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, station or county…" />
        <select className="input text-sm max-w-[12rem]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All court types</option>
          {COURT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <FilterTabs
          value={trash ? 'archived' : 'active'}
          onChange={v => setTrash(v === 'archived')}
          options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
        />
      </PageHeader>

      <DataTable
        caption="Courts register"
        columns={columns}
        rows={filtered}
        rowKey={c => c.id}
        loading={loading}
        empty={
          <EmptyState
            icon={search || typeFilter !== 'all' ? undefined : Archive}
            title={search || typeFilter !== 'all' ? 'No courts match those filters' : trash ? 'Nothing archived' : 'No courts yet'}
            description={search || typeFilter !== 'all' ? 'Clear the search or pick a different court type.' : undefined}
          />
        }
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Court' : 'Edit Court'}
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Court' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Court Name *</label>
          <input className="input text-sm" value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="High Court of Kenya" />
        </div>
        <div>
          <label className="label">Court Type *</label>
          <select
            className="input text-sm"
            value={editing?.court_type || 'magistrate'}
            onChange={e => {
              const t = e.target.value
              // Superior courts under Chapter 10 of the Constitution.
              const superior = ['supreme', 'court_of_appeal', 'high_court', 'elc', 'elrc'].includes(t)
              setEditing({ ...editing, court_type: t, is_superior: superior })
            }}
          >
            {COURT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Registry</label>
          <select className="input text-sm" value={editing?.registry_type || 'unspecified'} onChange={e => setEditing({ ...editing, registry_type: e.target.value })}>
            {REGISTRY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            Leave Unspecified unless you can confirm this station is a main registry, sub-registry, or a named division of another.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Station</label>
            <input className="input text-sm" value={editing?.station || ''} onChange={e => setEditing({ ...editing, station: e.target.value })} placeholder="Milimani, Nairobi" />
          </div>
          <div>
            <label className="label">County</label>
            <input className="input text-sm" value={editing?.county || ''} onChange={e => setEditing({ ...editing, county: e.target.value })} placeholder="Nairobi" />
          </div>
        </div>
        <div>
          <label className="label">Physical Address</label>
          <input className="input text-sm" value={editing?.physical_address || ''} onChange={e => setEditing({ ...editing, physical_address: e.target.value })} />
        </div>
        <div>
          <label className="label">Notes (jurisdiction, divisions, registry)</label>
          <textarea rows={2} className="input text-sm" value={editing?.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editing?.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Available when filing new matters</span>
        </label>
      </Modal>
    </div>
  )
}
