'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, Download, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

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
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const selection = useSelection(items)

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
      const res = isNew
        ? await fetch('/api/testimonials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/testimonials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'Testimonial added' : 'Saved'); setEditing(null); load() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Move this testimonial to trash?')) return
    const res = await fetch(`/api/testimonials?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Testimonials</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{items.length} testimonials {trash ? 'in trash' : ''}, shown on the homepage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing({ display_order: items.length }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Testimonial
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No testimonials yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(t => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={selection.selected.has(t.id)} onChange={() => selection.toggle(t.id)} />
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{t.client_name}</h3>
                    <p className="text-xs text-[var(--color-muted)]">{t.client_role}</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {trash ? (
                    <button onClick={async () => { await fetch('/api/testimonials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, restore: true }) }); load() }}
                      className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                  ) : (
                    <>
                      <button onClick={() => { setEditing(t); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteItem(t.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
            </div>
          ))}
        </div>
      )}

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={trash ? [{ label: 'Restore', onClick: () => bulkAction('restore') }] : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Testimonial' : 'Edit Testimonial'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Client Name *</label>
                <input className="input text-sm" value={editing.client_name || ''} onChange={e => setEditing({ ...editing, client_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Role / Company</label>
                <input className="input text-sm" value={editing.client_role || ''} onChange={e => setEditing({ ...editing, client_role: e.target.value })} placeholder="CEO, Nairobi Tech Ltd" />
              </div>
              <div>
                <label className="label">Quote *</label>
                <textarea rows={4} className="input text-sm" value={editing.quote || ''} onChange={e => setEditing({ ...editing, quote: e.target.value })} />
              </div>
              <ImagePicker value={editing.avatar_url || ''} onChange={(url) => setEditing({ ...editing, avatar_url: url })} label="Avatar (optional)" />
              <div>
                <label className="label">Display Order</label>
                <input type="number" className="input text-sm" value={editing.display_order ?? 0} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Testimonial' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
