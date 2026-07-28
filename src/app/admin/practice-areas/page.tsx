'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, Download, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

interface Group {
  id: string
  name: string
  slug: string
  description?: string
  image_url?: string
  display_order: number
}

interface PracticeArea {
  id: string
  title: string
  slug: string
  short_description?: string
  description?: string
  highlights?: string[]
  image_url?: string
  display_order: number
  group_id?: string | null
  group?: { id: string; name: string; slug: string } | null
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Group> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/practice-area-groups')
      .then(r => r.json())
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing?.name) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const payload = { ...editing, slug: editing.slug || slugify(editing.name) }
      const res = isNew
        ? await fetch('/api/practice-area-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/practice-area-groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast.success(isNew ? 'Group added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed, has migration 024_practice_area_groups.sql been run?')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this group? Practice areas in it will become ungrouped, not deleted.')) return
    const res = await fetch(`/api/practice-area-groups?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); load() }
    else toast.error('Failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[var(--color-text-muted)] text-sm">
          {groups.length} groups, these are the categories shown on the homepage and as the sidebar on the Capabilities page.
        </p>
        <button onClick={() => { setEditing({ display_order: groups.length }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Group
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : groups.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">
          No groups yet. If you just ran migration 024, this should be seeded already, otherwise add your first group above.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(g => (
            <div key={g.id} className="card p-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{g.name}</h3>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">/services#{g.slug} · order {g.display_order}</p>
                {g.description && <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">{g.description}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditing(g); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => remove(g.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Group' : 'Edit Group'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Name *</label>
                <input className="input text-sm" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Corporate, Banking & Finance" />
              </div>
              <div>
                <label className="label">Slug (leave blank to auto-generate)</label>
                <input className="input text-sm" value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder={editing.name ? slugify(editing.name) : ''} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={2} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <ImagePicker value={editing.image_url || ''} onChange={(url) => setEditing({ ...editing, image_url: url })} label="Card Image (homepage)" />
              <div>
                <label className="label">Display Order</label>
                <input type="number" className="input text-sm" value={editing.display_order ?? 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Group' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPracticeAreasPage() {
  const [tab, setTab] = useState<'areas' | 'groups'>('areas')
  const [areas, setAreas] = useState<PracticeArea[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<(Partial<PracticeArea> & { highlightsText?: string }) | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const selection = useSelection(areas)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    Promise.all([
      fetch(`/api/practice-areas?${params}`).then(r => r.json()),
      fetch('/api/practice-area-groups').then(r => r.json()).catch(() => []),
    ]).then(([a, g]) => {
      setAreas(Array.isArray(a) ? a : [])
      setGroups(Array.isArray(g) ? g : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...editing,
        slug: editing.slug || slugify(editing.title),
        group_id: editing.group_id || null,
        highlights: (editing.highlightsText ?? (editing.highlights || []).join(', '))
          .split(',').map(s => s.trim()).filter(Boolean),
      }
      delete (payload as { highlightsText?: string }).highlightsText
      delete (payload as { group?: unknown }).group
      const res = isNew
        ? await fetch('/api/practice-areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/practice-areas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast.success(isNew ? 'Practice area added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteArea(id: string) {
    if (!confirm('Move this practice area to trash?')) return
    const res = await fetch(`/api/practice-areas?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/practice-areas?id=${id}`, { method: 'DELETE' })
        : fetch('/api/practice-areas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) { toast.success(action === 'delete' ? 'Moved to trash' : 'Restored'); selection.clear(); load() }
    else toast.error('Some items failed')
  }

  function handleExport() {
    exportToCsv('practice-areas', areas, [
      { header: 'Title', accessor: (a) => a.title },
      { header: 'Slug', accessor: (a) => a.slug },
      { header: 'Group', accessor: (a) => a.group?.name ?? '' },
      { header: 'Short Description', accessor: (a) => a.short_description ?? '' },
      { header: 'Order', accessor: (a) => a.display_order },
    ])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Practice Areas</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{areas.length} practice areas {trash ? 'in trash' : ''}, grouped into {groups.length} categories that power the homepage cards, the Capabilities page, and the Services nav dropdown</p>
        </div>
        {tab === 'areas' && (
          <div className="flex gap-2">
            <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
              <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
            </button>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => { setEditing({ display_order: areas.length, highlights: [] }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Practice Area
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-0 border-b border-[var(--color-border)] mb-6">
        {(['areas', 'groups'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'
            }`}>
            {t === 'areas' ? 'Practice Areas' : 'Groups'}
          </button>
        ))}
      </div>

      {tab === 'groups' ? <GroupsTab /> : loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : areas.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No practice areas yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map(area => (
            <div key={area.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={selection.selected.has(area.id)} onChange={() => selection.toggle(area.id)} />
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{area.title}</h3>
                    <p className="text-xs text-[var(--color-muted)]">/services#{area.slug} · order {area.display_order}</p>
                    {area.group ? (
                      <span className="badge status-active text-[0.65rem] mt-1">{area.group.name}</span>
                    ) : (
                      <span className="text-[0.65rem] text-red-500 block mt-1">Ungrouped</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {trash ? (
                    <button onClick={async () => { await fetch('/api/practice-areas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: area.id, restore: true }) }); load() }}
                      className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                  ) : (
                    <>
                      <button onClick={() => { setEditing({ ...area, highlightsText: (area.highlights || []).join(', ') }); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteArea(area.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
              {area.short_description && <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{area.short_description}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'areas' && (
        <BulkActionBar
          count={selection.count}
          onClear={selection.clear}
          actions={trash ? [{ label: 'Restore', onClick: () => bulkAction('restore') }] : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]}
        />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Practice Area' : 'Edit Practice Area'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Group</label>
                <select className="input text-sm" value={editing.group_id || ''} onChange={e => setEditing({ ...editing, group_id: e.target.value || null })}>
                  <option value="">Ungrouped</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Slug (used for /services#slug, leave blank to auto-generate)</label>
                <input className="input text-sm" value={editing.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder={editing.title ? slugify(editing.title) : 'family-law'} />
              </div>
              <div>
                <label className="label">Short Description (homepage card)</label>
                <textarea rows={2} className="input text-sm" value={editing.short_description || ''} onChange={e => setEditing({ ...editing, short_description: e.target.value })} />
              </div>
              <div>
                <label className="label">Full Description (services page)</label>
                <textarea rows={3} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Key Services (comma-separated)</label>
                <input className="input text-sm" value={editing.highlightsText ?? (editing.highlights || []).join(', ')} onChange={e => setEditing({ ...editing, highlightsText: e.target.value })} placeholder="Divorce and Separation, Child Custody, Adoption" />
              </div>
              <ImagePicker value={editing.image_url || ''} onChange={(url) => setEditing({ ...editing, image_url: url })} label="Image" />
              <div>
                <label className="label">Display Order</label>
                <input type="number" className="input text-sm" value={editing.display_order ?? 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Practice Area' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
