'use client'
import { useEffect, useState } from 'react'
import { Calendar, Clock, User, Phone, Mail, Check, X, Edit2, Plus, Download, CalendarCheck } from 'lucide-react'
import { formatDate, MATTER_TYPES } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState,
  SearchInput, FilterTabs, type Tone,
} from '@/components/admin/ui'

interface Appointment {
  id: string
  client_name: string
  client_email: string
  client_phone?: string
  matter_type: string
  description?: string
  status: string
  scheduled_date?: string
  scheduled_time?: string
  duration_minutes: number
  location?: string
  meeting_link?: string
  notes?: string
  assigned_attorney?: { full_name: string }
  created_at: string
}

const STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

const STATUS_TONE: Record<string, Tone> = {
  pending: 'risk',
  confirmed: 'safe',
  cancelled: 'overdue',
  completed: 'done',
  no_show: 'overdue',
}

const EMPTY_NEW = {
  client_name: '',
  client_email: '',
  client_phone: '',
  matter_type: MATTER_TYPES[0]?.value || 'civil_litigation',
  description: '',
  status: 'pending',
  scheduled_date: '',
  scheduled_time: '',
  duration_minutes: 60,
  location: '',
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newAppt, setNewAppt] = useState(EMPTY_NEW)
  const [saving, setSaving] = useState(false)
  const [trash, setTrash] = useState(false)

  const filtered = appointments.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return a.client_name.toLowerCase().includes(q) || a.client_email.toLowerCase().includes(q)
  })
  const selection = useSelection(filtered)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    if (trash) params.set('trash', 'true')
    Promise.all([
      fetch(`/api/appointments?${params}&limit=50`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([appts, teamData]) => {
      setAppointments(appts.data || [])
      setTeam(teamData || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter, trash])

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/appointments/${id}`, { method: 'DELETE' })
        : fetch(`/api/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: true }) })
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
    exportToCsv('appointments', appointments, [
      { header: 'Client', accessor: (a) => a.client_name },
      { header: 'Email', accessor: (a) => a.client_email },
      { header: 'Phone', accessor: (a) => a.client_phone ?? '' },
      { header: 'Matter Type', accessor: (a) => a.matter_type },
      { header: 'Status', accessor: (a) => a.status },
      { header: 'Date', accessor: (a) => a.scheduled_date ?? '' },
      { header: 'Time', accessor: (a) => a.scheduled_time ?? '' },
      { header: 'Attorney', accessor: (a) => a.assigned_attorney?.full_name ?? '' },
    ])
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success('Updated'); load() }
    else toast.error('Update failed')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/appointments/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success('Appointment updated'); setEditing(null); load() }
      else toast.error('Update failed')
    } finally { setSaving(false) }
  }

  // The "New Appointment" button set state that nothing rendered, so it was
  // a no-op on every click. This is the dialog it was always meant to open.
  async function createAppointment() {
    if (!newAppt.client_name || !newAppt.client_email) {
      toast.error('Client name and email are required')
      return
    }
    setSaving(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(newAppt).filter(([, v]) => v !== '' && v !== undefined)
      )
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Appointment created')
        setShowCreate(false)
        setNewAppt(EMPTY_NEW)
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not create appointment')
      }
    } finally { setSaving(false) }
  }

  const pending = appointments.filter(a => a.status === 'pending').length
  const createButton = (
    <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> New Appointment
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={CalendarCheck}
        eyebrow="Client work"
        title="Appointments"
        description="Consultations booked from the website and by staff."
        meta={[
          `${filtered.length} ${trash ? 'in trash' : 'shown'}`,
          !trash && pending > 0 ? `${pending} awaiting scheduling` : null,
        ]}
        actions={
          <>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!appointments.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!trash && createButton}
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search client name or email…" />
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, ...STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))]}
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
          icon={CalendarCheck}
          title={search || filter !== 'all' ? 'No appointments match those filters' : trash ? 'Nothing in trash' : 'No appointments yet'}
          description={search || filter !== 'all' ? 'Clear the search or pick a different status.' : undefined}
          action={!search && filter === 'all' && !trash && createButton}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(appt => {
            const checked = selection.selected.has(appt.id)
            return (
              <div key={appt.id} className={`card p-5 ${checked ? 'ring-1 ring-[var(--color-accent)]' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <label className="flex items-start gap-2.5 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                      checked={checked}
                      onChange={() => selection.toggle(appt.id)}
                      aria-label={`Select ${appt.client_name}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--color-text-primary)] truncate">{appt.client_name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                        {MATTER_TYPES.find(m => m.value === appt.matter_type)?.label || appt.matter_type}
                      </span>
                    </span>
                  </label>
                  <StatusPill tone={STATUS_TONE[appt.status] || 'neutral'} dot>{appt.status.replace(/_/g, ' ')}</StatusPill>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs text-[var(--color-text-muted)] mb-3">
                  <span className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 flex-shrink-0" />{appt.client_email}</span>
                  {appt.client_phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 flex-shrink-0" />{appt.client_phone}</span>}
                  {appt.scheduled_date && (
                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 flex-shrink-0" />{formatDate(appt.scheduled_date, 'long')}</span>
                  )}
                  {appt.scheduled_time && (
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 flex-shrink-0" />{appt.scheduled_time} ({appt.duration_minutes} min)</span>
                  )}
                  {appt.assigned_attorney && (
                    <span className="flex items-center gap-1.5 col-span-2"><User className="w-3 h-3 flex-shrink-0" />{appt.assigned_attorney.full_name}</span>
                  )}
                </div>

                {appt.description && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-2 leading-relaxed">{appt.description}</p>
                )}

                <div className="flex gap-2 flex-wrap pt-3 border-t border-[var(--color-border)]">
                  {appt.status === 'pending' && (
                    <button onClick={() => setEditing(appt)} className="btn btn-outline !py-1.5 !px-3 text-xs gap-1.5">
                      <Edit2 className="w-3 h-3" /> Schedule and Confirm
                    </button>
                  )}
                  {appt.status === 'confirmed' && (
                    <button onClick={() => updateStatus(appt.id, 'completed')} className="btn btn-primary !py-1.5 !px-3 text-xs gap-1.5">
                      <Check className="w-3 h-3" /> Mark Complete
                    </button>
                  )}
                  {['pending', 'confirmed'].includes(appt.status) && (
                    <button onClick={() => updateStatus(appt.id, 'cancelled')} className="btn btn-ghost !py-1.5 !px-3 text-xs gap-1.5 text-[var(--status-danger)]">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  )}
                  <button onClick={() => setEditing(appt)} className="btn btn-ghost !py-1.5 !px-3 text-xs gap-1.5 ml-auto">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                </div>
              </div>
            )
          })}
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

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Appointment"
        description="Book a consultation on behalf of a client."
        footer={
          <>
            <button onClick={createAppointment} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Creating…' : 'Create Appointment'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Client Name *</label>
            <input className="input text-sm" value={newAppt.client_name} onChange={e => setNewAppt(f => ({ ...f, client_name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Client Email *</label>
            <input type="email" className="input text-sm" value={newAppt.client_email} onChange={e => setNewAppt(f => ({ ...f, client_email: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input className="input text-sm" value={newAppt.client_phone} onChange={e => setNewAppt(f => ({ ...f, client_phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Matter Type</label>
            <select className="input text-sm" value={newAppt.matter_type} onChange={e => setNewAppt(f => ({ ...f, matter_type: e.target.value }))}>
              {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input text-sm" value={newAppt.scheduled_date} onChange={e => setNewAppt(f => ({ ...f, scheduled_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Time</label>
            <select className="input text-sm" value={newAppt.scheduled_time} onChange={e => setNewAppt(f => ({ ...f, scheduled_time: e.target.value }))}>
              <option value="">Select…</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Minutes</label>
            <input type="number" className="input text-sm" value={newAppt.duration_minutes} onChange={e => setNewAppt(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
          </div>
        </div>
        <div>
          <label className="label">Location / Meeting Link</label>
          <input className="input text-sm" value={newAppt.location} onChange={e => setNewAppt(f => ({ ...f, location: e.target.value }))} placeholder="Office address or video link" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input text-sm" value={newAppt.description} onChange={e => setNewAppt(f => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Appointment"
        description={editing?.client_name}
        footer={
          <>
            <button onClick={saveEdit} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input text-sm" value={editing?.scheduled_date || ''}
              onChange={e => editing && setEditing({ ...editing, scheduled_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Time</label>
            <select className="input text-sm" value={editing?.scheduled_time || ''}
              onChange={e => editing && setEditing({ ...editing, scheduled_time: e.target.value })}>
              <option value="">Select…</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Assign Attorney</label>
          <select className="input text-sm"
            value={(editing as { assigned_attorney_id?: string } | null)?.assigned_attorney_id || ''}
            onChange={e => editing && setEditing({ ...editing, assigned_attorney_id: e.target.value } as Appointment & { assigned_attorney_id: string })}>
            <option value="">Unassigned</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input text-sm" value={editing?.status || 'pending'}
            onChange={e => editing && setEditing({ ...editing, status: e.target.value })}>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location / Meeting Link</label>
          <input className="input text-sm" value={editing?.location || ''}
            onChange={e => editing && setEditing({ ...editing, location: e.target.value })}
            placeholder="Office address or video link" />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea rows={3} className="input text-sm" value={editing?.notes || ''}
            onChange={e => editing && setEditing({ ...editing, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
