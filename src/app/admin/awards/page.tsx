'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, Download, ArchiveRestore, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, Modal, EmptyState, LoadingState, SearchInput, FilterTabs,
} from '@/components/admin/ui'

interface Award {
  id: string
  title: string
  issuer?: string
  year?: number
  description?: string
  image_url?: string
  is_featured: boolean
  display_order: number
}

export default function AdminAwardsPage() {
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Award> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = awards.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.title.toLowerCase().includes(q) || (a.issuer || '').toLowerCase().includes(q) || String(a.year || '').includes(q)
  })
  // Keyed to the visible rows, not every loaded row, so "select all" can
  // never reach something the current search is hiding.
  const selection = useSelection(filtered)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    fetch(`/api/awards?${params}`)
      .then(r => r.json())
      .then(d => setAwards(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/awards', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Award added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function deleteAward(id: string) {
    if (!confirm('Move this award to trash?')) return
    const res = await fetch(`/api/awards?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/awards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/awards?id=${id}`, { method: 'DELETE' })
        : fetch('/api/awards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) { toast.success(action === 'delete' ? 'Moved to trash' : 'Restored'); selection.clear(); load() }
    else toast.error('Some items failed')
  }

  function handleExport() {
    exportToCsv('awards', awards, [
      { header: 'Title', accessor: (a) => a.title },
      { header: 'Issuer', accessor: (a) => a.issuer ?? '' },
      { header: 'Year', accessor: (a) => a.year ?? '' },
      { header: 'Featured', accessor: (a) => a.is_featured ? 'Yes' : 'No' },
    ])
  }

  const addButton = (
    <button onClick={() => { setEditing({ is_featured: false, display_order: 0 }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Award
    </button>
  )
  const featured = awards.filter(a => a.is_featured).length

  return (
    <div>
      <PageHeader
        icon={Trophy}
        eyebrow="Website content"
        title="Awards"
        description="Recognition shown on the homepage and the About page."
        meta={[
          `${filtered.length} ${trash ? 'in trash' : 'award' + (filtered.length === 1 ? '' : 's')}`,
          !trash && featured > 0 ? `${featured} featured` : null,
        ]}
        actions={
          <>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!awards.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!trash && addButton}
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, issuer or year…" />
        <FilterTabs
          value={trash ? 'trash' : 'live'}
          onChange={v => { setTrash(v === 'trash'); selection.clear() }}
          options={[{ value: 'live', label: 'Live' }, { value: 'trash', label: 'Trash' }]}
        />
      </PageHeader>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={search ? 'No awards match that search' : trash ? 'Nothing in trash' : 'No awards yet'}
          description={search ? 'Try a different word, or clear the search.' : undefined}
          action={!search && !trash && addButton}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(award => {
            const checked = selection.selected.has(award.id)
            return (
              <div key={award.id} className={`card p-4 group transition-shadow ${checked ? 'ring-1 ring-[var(--color-accent)]' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <label className="flex items-start gap-2.5 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                      checked={checked}
                      onChange={() => selection.toggle(award.id)}
                      aria-label={`Select ${award.title}`}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold text-sm text-[var(--color-text-primary)]">
                        {award.is_featured && <Star className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-brand)] fill-[var(--color-brand)]" />}
                        <span className="truncate">{award.title}</span>
                      </span>
                      {(award.issuer || award.year) && (
                        <span className="block text-xs text-[var(--color-text-muted)] truncate">
                          {award.issuer}{award.year ? `${award.issuer ? ' · ' : ''}${award.year}` : ''}
                        </span>
                      )}
                    </span>
                  </label>
                  <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {trash ? (
                      <button onClick={() => restore(award.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(award); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteAward(award.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                {award.description && <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">{award.description}</p>}
              </div>
            )
          })}
        </div>
      )}

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={trash ? [{ label: 'Restore', onClick: () => bulkAction('restore') }] : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Award' : 'Edit Award'}
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Award' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={editing?.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Issuer</label>
            <input className="input text-sm" value={editing?.issuer || ''} onChange={e => setEditing({ ...editing, issuer: e.target.value })} />
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input text-sm" value={editing?.year || ''} onChange={e => setEditing({ ...editing, year: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input text-sm" value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        </div>
        <ImagePicker value={editing?.image_url || ''} onChange={(url) => setEditing({ ...editing, image_url: url })} label="Image" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editing?.is_featured || false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Featured</span>
        </label>
      </Modal>
    </div>
  )
}
