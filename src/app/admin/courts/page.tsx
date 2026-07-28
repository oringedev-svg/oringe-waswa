'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, ArchiveRestore, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { COURT_TYPES, courtTypeLabel, REGISTRY_TYPES, registryTypeLabel } from '@/lib/litigationStatus'

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
      const res = isNew
        ? await fetch('/api/courts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/courts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'Court added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Archive this court? Matters already filed there keep their record.')) return
    const res = await fetch(`/api/courts?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Archived'); load() } else toast.error('Failed')
  }

  const filtered = courts.filter(c => {
    if (typeFilter !== 'all' && c.court_type !== typeFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.station || '').toLowerCase().includes(q) || (c.county || '').toLowerCase().includes(q)
  })

  if (missing) {
    return (
      <div className="card p-12 text-center">
        <Landmark className="w-8 h-8 mx-auto mb-3 text-[var(--color-muted)]" />
        <h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mb-2">Courts register not set up yet</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          Run migration <code>025_courts_and_litigation.sql</code> in the Supabase SQL editor to create the courts
          register and seed it with the Kenyan courts.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Courts Register</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {filtered.length} courts {trash ? 'archived' : 'available'}. Matters pick their court from this list, so a
            case is never filed against a mistyped court name.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTrash(!trash)} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Archived' : 'Archived'}
          </button>
          {!trash && (
            <button onClick={() => { setEditing({ court_type: 'magistrate', is_superior: false, is_active: true, display_order: courts.length }); setIsNew(true) }}
              className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Court
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        <input className="input text-sm max-w-xs" placeholder="Search name, station or county…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input text-sm max-w-xs" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All court types</option>
          {COURT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No courts match.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-overlay)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Court</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Registry</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">County</th>
                <th className="px-4 py-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
                    {!c.is_active && <span className="text-xs text-red-500">Inactive</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge text-xs">{courtTypeLabel(c.court_type)}</span>
                    {c.is_superior && <span className="text-[0.65rem] text-[var(--color-muted)] ml-1.5">superior</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {(c.registry_type ?? 'unspecified') === 'unspecified' ? (
                      <span className="text-[var(--color-muted)]">-</span>
                    ) : (
                      <span className="badge text-xs">{registryTypeLabel(c.registry_type!)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.station || '-'}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.county || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {trash ? (
                        <button onClick={async () => { await fetch('/api/courts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, restore: true, is_active: true }) }); load() }}
                          className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                      ) : (
                        <>
                          <button onClick={() => { setEditing(c); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => remove(c.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Court' : 'Edit Court'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Court Name *</label>
                <input className="input text-sm" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="High Court of Kenya" />
              </div>
              <div>
                <label className="label">Court Type *</label>
                <select className="input text-sm" value={editing.court_type || 'magistrate'}
                  onChange={e => {
                    const t = e.target.value
                    // Superior courts under Chapter 10 of the Constitution.
                    const superior = ['supreme', 'court_of_appeal', 'high_court', 'elc', 'elrc'].includes(t)
                    setEditing({ ...editing, court_type: t, is_superior: superior })
                  }}>
                  {COURT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Registry</label>
                <select className="input text-sm" value={editing.registry_type || 'unspecified'}
                  onChange={e => setEditing({ ...editing, registry_type: e.target.value })}>
                  {REGISTRY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Leave Unspecified unless you can confirm this station is a main registry, sub-registry, or a named division of another.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Station</label>
                  <input className="input text-sm" value={editing.station || ''} onChange={e => setEditing({ ...editing, station: e.target.value })} placeholder="Milimani, Nairobi" />
                </div>
                <div>
                  <label className="label">County</label>
                  <input className="input text-sm" value={editing.county || ''} onChange={e => setEditing({ ...editing, county: e.target.value })} placeholder="Nairobi" />
                </div>
              </div>
              <div>
                <label className="label">Physical Address</label>
                <input className="input text-sm" value={editing.physical_address || ''} onChange={e => setEditing({ ...editing, physical_address: e.target.value })} />
              </div>
              <div>
                <label className="label">Notes (jurisdiction, divisions, registry)</label>
                <textarea rows={2} className="input text-sm" value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Available when filing new matters</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Court' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
