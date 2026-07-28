'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, Loader2, X, Archive, Download, ArchiveRestore, Megaphone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

interface InsightItem {
  id: string
  title: string
  type: string
  description?: string
  media_url?: string
  thumbnail_url?: string
  external_url?: string
  source?: string
  category: string
  is_featured: boolean
  published_at: string
}

const TYPES = ['video', 'audio', 'news', 'article']
const CATEGORIES = ['Legal', 'Corporate', 'Family', 'Criminal', 'Property', 'Immigration', 'Firm News', 'General']

export default function AdminInsightsPage() {
  const [items, setItems] = useState<InsightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Partial<InsightItem> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [trash, setTrash] = useState(false)
  const [announcedId, setAnnouncedId] = useState<string | null>(null)
  const selection = useSelection(items)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50', admin: 'true' })
    if (filter !== 'all') params.set('type', filter)
    if (trash) params.set('trash', 'true')
    fetch(`/api/insights?${params}`)
      .then(r => r.json())
      .then(d => setItems(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter, trash])

  // Which item is currently on the homepage announcement bar, so the
  // megaphone shows lit on the right row.
  useEffect(() => {
    fetch('/api/announcement')
      .then(r => r.json())
      .then(d => setAnnouncedId(d?.announcement?.id ?? null))
      .catch(() => {})
  }, [])

  async function save() {
    if (!editing?.title || !editing?.type) { toast.error('Title and type required'); return }
    setSaving(true)
    try {
      let res
      if (isNew) {
        res = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editing, published_at: new Date().toISOString() }),
        })
      } else {
        res = await fetch('/api/insights', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        })
      }
      if (res.ok) { toast.success('Saved!'); setEditing(null); load() }
      else toast.error('Save failed')
    } catch { toast.error('Error') }
    finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    if (!confirm('Move this insight to trash?')) return
    const res = await fetch(`/api/insights?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restoreItem(id: string) {
    const res = await fetch('/api/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restore: true }),
    })
    if (res.ok) { toast.success('Restored'); load() }
    else toast.error('Restore failed')
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/insights?id=${id}`, { method: 'DELETE' })
        : fetch('/api/insights', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) {
      toast.success(action === 'delete' ? 'Moved to trash' : 'Restored')
      selection.clear()
      load()
    } else {
      toast.error('Some items failed to update')
    }
  }

  function handleExport() {
    exportToCsv('insights', items, [
      { header: 'Title', accessor: (i) => i.title },
      { header: 'Type', accessor: (i) => i.type },
      { header: 'Category', accessor: (i) => i.category },
      { header: 'Source', accessor: (i) => i.source ?? '' },
      { header: 'Featured', accessor: (i) => i.is_featured ? 'Yes' : 'No' },
      { header: 'Published', accessor: (i) => i.published_at },
    ])
  }

  async function toggleFeatured(item: InsightItem) {
    await fetch('/api/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_featured: !item.is_featured }),
    })
    load()
  }

  // Only one item is ever announced, so pushing a second replaces the first
  // rather than stacking banners. Clicking the already-announced item clears
  // the banner from the homepage entirely.
  async function toggleAnnouncement(item: InsightItem) {
    const next = announcedId === item.id ? null : item.id
    const res = await fetch('/api/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: next }),
    })
    if (!res.ok) { toast.error('Could not update the announcement'); return }
    setAnnouncedId(next)
    toast.success(next ? 'Pushed to the homepage announcement bar' : 'Announcement cleared')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Insights</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Videos, audio, news, and articles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing({ type: 'article', category: 'Legal', is_featured: false }); setIsNew(true) }}
            className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Insight
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === t ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}>
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No insights yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} />
                </th>
                {['Title', 'Type', 'Category', 'Source', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selection.selected.has(item.id)} onChange={() => selection.toggle(item.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                      <span className="font-medium text-[var(--color-text-primary)] line-clamp-1 max-w-64">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-[var(--color-text-muted)]">{item.type}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{item.category}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{item.source || '-'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{formatDate(item.published_at, 'short')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {trash ? (
                        <button onClick={() => restoreItem(item.id)} title="Restore" className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-accent)] transition-colors">
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => toggleFeatured(item)} title="Toggle featured"
                            className={`p-1.5 rounded transition-colors ${item.is_featured ? 'text-yellow-400' : 'text-[var(--color-muted)]'} hover:bg-[var(--color-surface-overlay)]`}>
                            <Star className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleAnnouncement(item)}
                            title={announcedId === item.id ? 'Remove from the homepage announcement bar' : 'Push to the homepage announcement bar'}
                            className={`p-1.5 rounded transition-colors ${announcedId === item.id ? 'text-[var(--color-brand)]' : 'text-[var(--color-muted)]'} hover:bg-[var(--color-surface-overlay)]`}>
                            <Megaphone className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setEditing(item); setIsNew(false) }}
                            className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-muted)] transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteItem(item.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={
          trash
            ? [{ label: 'Restore', onClick: () => bulkAction('restore') }]
            : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]
        }
      />

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg shadow-[var(--shadow-xl)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">
                {isNew ? 'Add Insight' : 'Edit Insight'}
              </h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing(f => ({ ...f!, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type *</label>
                  <select className="input text-sm" value={editing.type || 'article'} onChange={e => setEditing(f => ({ ...f!, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input text-sm" value={editing.category || 'Legal'} onChange={e => setEditing(f => ({ ...f!, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input text-sm" value={editing.description || ''} onChange={e => setEditing(f => ({ ...f!, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Media URL (video/audio file or embed)</label>
                <input className="input text-sm" value={editing.media_url || ''} onChange={e => setEditing(f => ({ ...f!, media_url: e.target.value }))} placeholder="https://…" />
              </div>
              <ImagePicker
                value={editing.thumbnail_url || ''}
                onChange={(url) => setEditing(f => ({ ...f!, thumbnail_url: url }))}
                label="Thumbnail Image"
              />
              <div>
                <label className="label">External URL</label>
                <input className="input text-sm" value={editing.external_url || ''} onChange={e => setEditing(f => ({ ...f!, external_url: e.target.value }))} placeholder="https://…" />
              </div>
              <div>
                <label className="label">Source</label>
                <input className="input text-sm" value={editing.source || ''} onChange={e => setEditing(f => ({ ...f!, source: e.target.value }))} placeholder="e.g. Nation Media, Reuters" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_featured || false} onChange={e => setEditing(f => ({ ...f!, is_featured: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Feature on insights page</span>
              </label>
              <div className="flex gap-3">
                <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isNew ? 'Add Insight' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
