'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, Loader2, X, Archive, Download, ArchiveRestore, MapPin, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { formatDate, getStatusColor } from '@/lib/utils'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

interface Event {
  id: string
  title: string
  description?: string
  event_date?: string
  end_date?: string
  location?: string
  image_url?: string
  registration_url?: string
  status: 'upcoming' | 'past' | 'cancelled'
  is_featured: boolean
}

const STATUSES = ['all', 'upcoming', 'past', 'cancelled']

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<Event> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const selection = useSelection(events)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (trash) params.set('trash', 'true')
    fetch(`/api/events?${params}`)
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status, trash])

  async function save() {
    if (!editing?.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = isNew
        ? await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'Event added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Move this event to trash?')) return
    const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/events?id=${id}`, { method: 'DELETE' })
        : fetch('/api/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) { toast.success(action === 'delete' ? 'Moved to trash' : 'Restored'); selection.clear(); load() }
    else toast.error('Some items failed')
  }

  function handleExport() {
    exportToCsv('events', events, [
      { header: 'Title', accessor: (e) => e.title },
      { header: 'Status', accessor: (e) => e.status },
      { header: 'Date', accessor: (e) => e.event_date ?? '' },
      { header: 'Location', accessor: (e) => e.location ?? '' },
    ])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Events</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{events.length} events {trash ? 'in trash' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing({ status: 'upcoming', is_featured: false }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
              status === s ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No events found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(event => (
            <div key={event.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={selection.selected.has(event.id)} onChange={() => selection.toggle(event.id)} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {event.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{event.title}</h3>
                    <span className={`badge ${getStatusColor(event.status)} text-xs`}>{event.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    {event.event_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.event_date, 'short')}</span>}
                    {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {trash ? (
                  <button onClick={async () => { await fetch('/api/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: event.id, restore: true }) }); load() }}
                    className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(event); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteEvent(event.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Event' : 'Edit Event'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date and Time</label>
                  <input type="datetime-local" className="input text-sm" value={editing.event_date?.slice(0, 16) || ''} onChange={e => setEditing({ ...editing, event_date: new Date(e.target.value).toISOString() })} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input text-sm" value={editing.status || 'upcoming'} onChange={e => setEditing({ ...editing, status: e.target.value as Event['status'] })}>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input text-sm" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} />
              </div>
              <div>
                <label className="label">Registration URL</label>
                <input className="input text-sm" value={editing.registration_url || ''} onChange={e => setEditing({ ...editing, registration_url: e.target.value })} placeholder="https://…" />
              </div>
              <ImagePicker value={editing.image_url || ''} onChange={(url) => setEditing({ ...editing, image_url: url })} label="Image" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_featured || false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Featured</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Event' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
