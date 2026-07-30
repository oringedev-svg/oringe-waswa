'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, Download, ArchiveRestore, MapPin, Calendar, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { formatDate } from '@/lib/utils'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState, SearchInput, FilterTabs, type Tone,
} from '@/components/admin/ui'

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

const STATUS_TONE: Record<Event['status'], Tone> = {
  upcoming: 'safe',
  past: 'done',
  cancelled: 'overdue',
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'all' | Event['status']>('all')
  const [trash, setTrash] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Event> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = events.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.title.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q)
  })
  const selection = useSelection(filtered)

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
      const res = await fetch('/api/events', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Event added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Move this event to trash?')) return
    const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
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

  const addButton = (
    <button onClick={() => { setEditing({ status: 'upcoming', is_featured: false }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Event
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={CalendarDays}
        eyebrow="Website content"
        title="Events"
        description="Seminars, webinars and firm events listed on the public site."
        meta={[`${filtered.length} ${trash ? 'in trash' : 'event' + (filtered.length === 1 ? '' : 's')}`]}
        actions={
          <>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!events.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!trash && addButton}
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search title or location…" />
        <FilterTabs
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
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
          icon={CalendarDays}
          title={search || status !== 'all' ? 'No events match those filters' : trash ? 'Nothing in trash' : 'No events yet'}
          description={search || status !== 'all' ? 'Clear the search or pick a different status.' : undefined}
          action={!search && status === 'all' && !trash && addButton}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(event => {
            const checked = selection.selected.has(event.id)
            return (
              <div key={event.id} className={`card p-4 flex items-start justify-between gap-3 group ${checked ? 'ring-1 ring-[var(--color-accent)]' : ''}`}>
                <label className="flex items-start gap-2.5 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                    checked={checked}
                    onChange={() => selection.toggle(event.id)}
                    aria-label={`Select ${event.title}`}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 mb-1 flex-wrap">
                      {event.is_featured && <Star className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-brand)] fill-[var(--color-brand)]" />}
                      <span className="font-semibold text-sm text-[var(--color-text-primary)]">{event.title}</span>
                      <StatusPill tone={STATUS_TONE[event.status]}>{event.status}</StatusPill>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                      {event.event_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(event.event_date, 'short')}</span>}
                      {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
                    </span>
                  </span>
                </label>
                <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {trash ? (
                    <button onClick={() => restore(event.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                  ) : (
                    <>
                      <button onClick={() => { setEditing(event); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteEvent(event.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
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
        title={isNew ? 'Add Event' : 'Edit Event'}
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Event' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={editing?.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input text-sm" value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date and Time</label>
            <input
              type="datetime-local"
              className="input text-sm"
              value={editing?.event_date?.slice(0, 16) || ''}
              onChange={e => {
                // Clearing the field yields '', and new Date('').toISOString()
                // throws a RangeError, which took the whole dialog down.
                const v = e.target.value
                setEditing({ ...editing, event_date: v ? new Date(v).toISOString() : undefined })
              }}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input text-sm" value={editing?.status || 'upcoming'} onChange={e => setEditing({ ...editing, status: e.target.value as Event['status'] })}>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input text-sm" value={editing?.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} />
        </div>
        <div>
          <label className="label">Registration URL</label>
          <input className="input text-sm" value={editing?.registration_url || ''} onChange={e => setEditing({ ...editing, registration_url: e.target.value })} placeholder="https://…" />
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
