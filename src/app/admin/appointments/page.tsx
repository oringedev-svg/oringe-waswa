'use client'
import { useEffect, useState } from 'react'
import { Calendar, Clock, User, Phone, Mail, Loader2, Check, X, Edit2, Plus, Archive, Download } from 'lucide-react'
import { formatDate, getStatusColor, MATTER_TYPES } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

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

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [trash, setTrash] = useState(false)
  const selection = useSelection(appointments)

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

  async function updateStatus(id: string, status: string, extraData?: Record<string, unknown>) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extraData }),
    })
    if (res.ok) { toast.success('Updated!'); load() }
    else toast.error('Update failed')
  }

  async function saveEdit() {
    if (!editing) return
    const res = await fetch(`/api/appointments/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    if (res.ok) { toast.success('Appointment updated!'); setEditing(null); load() }
    else toast.error('Update failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Appointments</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Manage all client consultations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Appointment
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
            }`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Appointments Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : appointments.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No appointments found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {appointments.map(appt => (
            <div key={appt.id} className="card p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={selection.selected.has(appt.id)} onChange={() => selection.toggle(appt.id)} />
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">{appt.client_name}</h3>
                    <p className="text-xs text-[var(--color-muted)] capitalize mt-0.5">
                      {MATTER_TYPES.find(m => m.value === appt.matter_type)?.label || appt.matter_type}
                    </p>
                  </div>
                </div>
                <span className={`badge ${getStatusColor(appt.status)} text-xs flex-shrink-0`}>{appt.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-muted)] mb-3">
                <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{appt.client_email}</span>
                {appt.client_phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{appt.client_phone}</span>}
                {appt.scheduled_date && (
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{formatDate(appt.scheduled_date, 'long')}</span>
                )}
                {appt.scheduled_time && (
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{appt.scheduled_time} ({appt.duration_minutes} min)</span>
                )}
                {appt.assigned_attorney && (
                  <span className="flex items-center gap-1.5 col-span-2"><User className="w-3 h-3" />{appt.assigned_attorney.full_name}</span>
                )}
              </div>

              {appt.description && (
                <p className="text-xs text-[var(--color-text-muted)] mb-3 line-clamp-2">{appt.description}</p>
              )}

              <div className="flex gap-2 flex-wrap">
                {appt.status === 'pending' && (
                  <button onClick={() => setEditing(appt)} className="btn btn-outline text-xs gap-1.5 py-1.5">
                    <Edit2 className="w-3 h-3" /> Schedule and Confirm
                  </button>
                )}
                {appt.status === 'confirmed' && (
                  <button onClick={() => updateStatus(appt.id, 'completed')} className="btn btn-primary text-xs gap-1.5 py-1.5">
                    <Check className="w-3 h-3" /> Mark Complete
                  </button>
                )}
                {['pending', 'confirmed'].includes(appt.status) && (
                  <button onClick={() => updateStatus(appt.id, 'cancelled')} className="btn btn-ghost text-xs gap-1.5 py-1.5 text-red-500">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                )}
                <button onClick={() => setEditing(appt)} className="btn btn-ghost text-xs gap-1.5 py-1.5">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              </div>
            </div>
          ))}
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
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)] mb-5">Edit Appointment</h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input text-sm"
                    value={editing.scheduled_date || ''}
                    onChange={e => setEditing({ ...editing, scheduled_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <select className="input text-sm" value={editing.scheduled_time || ''}
                    onChange={e => setEditing({ ...editing, scheduled_time: e.target.value })}>
                    <option value="">Select…</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Assign Attorney</label>
                <select className="input text-sm"
                  value={(editing as { assigned_attorney_id?: string }).assigned_attorney_id || ''}
                  onChange={e => setEditing({ ...editing, assigned_attorney_id: e.target.value } as Appointment & { assigned_attorney_id: string })}>
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input text-sm" value={editing.status}
                  onChange={e => setEditing({ ...editing, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Location / Meeting Link</label>
                <input className="input text-sm" value={editing.location || ''}
                  onChange={e => setEditing({ ...editing, location: e.target.value })}
                  placeholder="Office address or video link" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea rows={3} className="input text-sm" value={editing.notes || ''}
                  onChange={e => setEditing({ ...editing, notes: e.target.value } as Appointment & { notes: string })} />
              </div>
              <div className="flex gap-3">
                <button onClick={saveEdit} className="btn btn-primary flex-1">Save Changes</button>
                <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
