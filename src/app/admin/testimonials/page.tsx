'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Download, ArchiveRestore, Quote } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, Modal, EmptyState, LoadingState, SearchInput, FilterTabs,
} from '@/components/admin/ui'

interface Testimonial {
  id: string
  client_name: string
  client_role?: string
  quote: string
  avatar_url?: string
  display_order: number
}

export default function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = items.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.client_name.toLowerCase().includes(q) || t.quote.toLowerCase().includes(q) || (t.client_role || '').toLowerCase().includes(q)
  })
  // Selection tracks what is actually on screen. Keyed off `items` it let a
  // "Select all" survive a search and then act on rows the user could not see.
  const selection = useSelection(filtered)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    fetch(`/api/testimonials?${params}`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.client_name || !editing?.quote) { toast.error('Name and quote are required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/testimonials', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Testimonial added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    if (!confirm('Move this testimonial to trash?')) return
    const res = await fetch(`/api/testimonials?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/testimonials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/testimonials?id=${id}`, { method: 'DELETE' })
        : fetch('/api/testimonials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) { toast.success(action === 'delete' ? 'Moved to trash' : 'Restored'); selection.clear(); load() }
    else toast.error('Some items failed')
  }

  function handleExport() {
    exportToCsv('testimonials', items, [
      { header: 'Client Name', accessor: (t) => t.client_name },
      { header: 'Role', accessor: (t) => t.client_role ?? '' },
      { header: 'Quote', accessor: (t) => t.quote },
    ])
  }

  const addButton = (
    <button onClick={() => { setEditing({ display_order: items.length }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Testimonial
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={Quote}
        eyebrow="Website content"
        title="Testimonials"
        description="Shown on the homepage, in display order."
        meta={[`${filtered.length} ${trash ? 'in trash' : 'live'}`]}
        actions={
          <>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!items.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!trash && addButton}
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search client or quote…" />
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
          icon={Quote}
          title={search ? 'No testimonials match that search' : trash ? 'Nothing in trash' : 'No testimonials yet'}
          description={search ? 'Try a different word, or clear the search.' : trash ? undefined : 'Client quotes carry more weight on the homepage than any claim the firm makes about itself.'}
          action={!search && !trash && addButton}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(t => {
            const checked = selection.selected.has(t.id)
            return (
              <div
                key={t.id}
                className={`card p-4 flex flex-col group transition-shadow ${checked ? 'ring-1 ring-[var(--color-accent)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <label className="flex items-start gap-2.5 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                      checked={checked}
                      onChange={() => selection.toggle(t.id)}
                      aria-label={`Select ${t.client_name}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm text-[var(--color-text-primary)] truncate">{t.client_name}</span>
                      {t.client_role && <span className="block text-xs text-[var(--color-text-muted)] truncate">{t.client_role}</span>}
                    </span>
                  </label>
                  <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    {trash ? (
                      <button onClick={() => restore(t.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(t); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteItem(t.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
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
        title={isNew ? 'Add Testimonial' : 'Edit Testimonial'}
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Testimonial' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Client Name *</label>
          <input className="input text-sm" value={editing?.client_name || ''} onChange={e => setEditing({ ...editing, client_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Role / Company</label>
          <input className="input text-sm" value={editing?.client_role || ''} onChange={e => setEditing({ ...editing, client_role: e.target.value })} placeholder="CEO, Nairobi Tech Ltd" />
        </div>
        <div>
          <label className="label">Quote *</label>
          <textarea rows={4} className="input text-sm" value={editing?.quote || ''} onChange={e => setEditing({ ...editing, quote: e.target.value })} />
        </div>
        <ImagePicker value={editing?.avatar_url || ''} onChange={(url) => setEditing({ ...editing, avatar_url: url })} label="Avatar (optional)" />
        <div>
          <label className="label">Display Order</label>
          <input type="number" className="input text-sm" value={editing?.display_order ?? 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
        </div>
      </Modal>
    </div>
  )
}
