'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Clock, MapPin, Video, X, UserPlus, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// The shared calendar merges two sources into one agenda: appointments
// (client-booked consultations from the public site) and calendar_events
// (meetings staff create, internal or client-facing, bookable before any
// matter or even any account exists). One list, two origins.

interface Attendee {
  id: string
  team_member_id: string | null
  profile_id: string | null
  external_name: string | null
  external_email: string | null
  notified_at: string | null
  team_member?: { full_name: string } | null
  profile?: { full_name: string; email: string } | null
}

interface CalEvent {
  id: string
  title: string
  description: string | null
  type: string
  start_at: string
  end_at: string
  location: string | null
  meeting_link: string | null
  status: string
  matter?: { matter_number: string; title: string } | null
  submission?: { tracking_code: string; submitter_name: string } | null
  creator?: { full_name: string } | null
  attendees: Attendee[]
  source: 'event'
}

interface Appointment {
  id: string
  client_name: string
  matter_type: string
  status: string
  scheduled_date: string | null
  scheduled_time: string | null
  location: string | null
  meeting_link: string | null
  assigned_attorney?: { full_name: string } | null
  source: 'appointment'
}

type AgendaItem = (CalEvent | Appointment) & { sortKey: string }

const TYPE_BADGE: Record<string, string> = {
  meeting: 'status-review', court: 'status-rejected', deadline: 'status-pending',
  internal: 'status-active', other: 'status-pending',
}

export default function AdminCalendarPage() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<CalEvent | null>(null)

  const [form, setForm] = useState({
    title: '', description: '', type: 'meeting', date: '', startTime: '', endTime: '',
    location: '', meeting_link: '',
  })
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [externalAttendees, setExternalAttendees] = useState<{ name: string; email: string }[]>([])
  const [externalDraft, setExternalDraft] = useState({ name: '', email: '' })

  function load() {
    setLoading(true)
    const from = new Date(); from.setDate(from.getDate() - 7)
    const to = new Date(); to.setDate(to.getDate() + 90)
    Promise.all([
      fetch(`/api/calendar-events?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
      fetch('/api/appointments?limit=100').then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([events, appts, teamData]) => {
      const eventItems: AgendaItem[] = (Array.isArray(events) ? events : []).map((e: CalEvent) => ({ ...e, source: 'event', sortKey: e.start_at }))
      const apptItems: AgendaItem[] = (appts.data || []).filter((a: Appointment) => a.scheduled_date).map((a: Appointment) => ({
        ...a, source: 'appointment',
        sortKey: `${a.scheduled_date}T${a.scheduled_time || '00:00:00'}`,
      }))
      setItems([...eventItems, ...apptItems].sort((x, y) => x.sortKey.localeCompare(y.sortKey)))
      setTeam(Array.isArray(teamData) ? teamData : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function toggleAttendee(id: string) {
    setAttendeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function addExternal() {
    if (!externalDraft.email.trim()) { toast.error('An email is needed to invite them'); return }
    setExternalAttendees(prev => [...prev, { name: externalDraft.name.trim() || externalDraft.email.trim(), email: externalDraft.email.trim() }])
    setExternalDraft({ name: '', email: '' })
  }

  async function createMeeting() {
    if (!form.title.trim() || !form.date || !form.startTime || !form.endTime) {
      toast.error('Title, date, and start/end time are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          start_at: new Date(`${form.date}T${form.startTime}`).toISOString(),
          end_at: new Date(`${form.date}T${form.endTime}`).toISOString(),
          location: form.location.trim() || undefined,
          meeting_link: form.meeting_link.trim() || undefined,
          attendees: [
            ...attendeeIds.map(id => ({ team_member_id: id })),
            ...externalAttendees.map(a => ({ external_name: a.name, external_email: a.email })),
          ],
        }),
      })
      if (res.ok) {
        toast.success('Meeting scheduled, invites sent')
        setShowNew(false)
        setForm({ title: '', description: '', type: 'meeting', date: '', startTime: '', endTime: '', location: '', meeting_link: '' })
        setAttendeeIds([]); setExternalAttendees([])
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not schedule the meeting')
      }
    } finally {
      setSaving(false)
    }
  }

  async function cancelEvent(id: string) {
    if (!confirm('Cancel this meeting? Attendees will be notified.')) return
    const res = await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Meeting cancelled'); setSelected(null); load() }
    else toast.error('Could not cancel')
  }

  // Group by day for the agenda.
  const grouped: Record<string, AgendaItem[]> = {}
  for (const item of items) {
    const day = item.sortKey.slice(0, 10)
    grouped[day] = grouped[day] || []
    grouped[day].push(item)
  }
  const days = Object.keys(grouped).sort()

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Calendar</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Meetings, court dates, and deadlines, with attendees notified automatically.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Schedule Meeting
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : days.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">Nothing scheduled in the next 90 days.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(day => (
            <div key={day}>
              <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">{formatDate(day, 'long')}</div>
              <div className="flex flex-col gap-2">
                {grouped[day].map(item => (
                  item.source === 'event' ? (
                    <button key={item.id} onClick={() => setSelected(item as CalEvent)}
                      className="card p-4 flex items-center justify-between gap-4 text-left hover:border-[var(--color-accent)] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`badge ${TYPE_BADGE[item.type] || 'status-pending'} text-xs capitalize`}>{item.type}</span>
                          <span className="font-medium text-sm text-[var(--color-text-primary)]">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-muted)]">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.start_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
                          {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>}
                          {item.meeting_link && <span className="flex items-center gap-1"><Video className="w-3 h-3" />Online</span>}
                          {item.attendees?.length > 0 && <span>{item.attendees.length} attendee{item.attendees.length === 1 ? '' : 's'}</span>}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <Link key={item.id} href="/admin/appointments"
                      className="card p-4 flex items-center justify-between gap-4 hover:border-[var(--color-accent)] transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge status-active text-xs">Consultation</span>
                          <span className="font-medium text-sm text-[var(--color-text-primary)]">{(item as Appointment).client_name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-muted)]">
                          {(item as Appointment).scheduled_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(item as Appointment).scheduled_time!.slice(0, 5)}</span>}
                          <span>{(item as Appointment).assigned_attorney?.full_name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </Link>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Meeting */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)] mb-5">Schedule Meeting</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Intake consultation with Grace Wanjiru" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['meeting', 'internal', 'court', 'deadline', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Start *</label>
                  <input type="time" className="input text-sm" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input type="time" className="input text-sm" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input text-sm" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Nairobi office, boardroom 2" />
              </div>
              <div>
                <label className="label">Meeting Link</label>
                <input className="input text-sm" value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="https://meet.google.com/…" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea rows={2} className="input text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label className="label">Colleagues</label>
                <div className="flex flex-wrap gap-1.5">
                  {team.map(m => (
                    <button key={m.id} type="button" onClick={() => toggleAttendee(m.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        attendeeIds.includes(m.id) ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
                      }`}>
                      {m.full_name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Client or other guest (no account needed)</label>
                <div className="flex gap-2 mb-2">
                  <input className="input text-sm flex-1" placeholder="Name" value={externalDraft.name} onChange={e => setExternalDraft(d => ({ ...d, name: e.target.value }))} />
                  <input className="input text-sm flex-1" placeholder="Email" value={externalDraft.email} onChange={e => setExternalDraft(d => ({ ...d, email: e.target.value }))} />
                  <button type="button" onClick={addExternal} className="btn btn-outline text-sm gap-1.5 flex-shrink-0"><UserPlus className="w-3.5 h-3.5" /></button>
                </div>
                {externalAttendees.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {externalAttendees.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-surface-overlay)] rounded-md px-2.5 py-1.5">
                        <span>{a.name} · {a.email}</span>
                        <button onClick={() => setExternalAttendees(prev => prev.filter((_, idx) => idx !== i))} className="text-[var(--color-muted)] hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-2">
                <button onClick={createMeeting} disabled={saving} className="btn btn-primary flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Schedule &amp; Notify
                </button>
                <button onClick={() => setShowNew(false)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event detail */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-md shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">{selected.title}</h2>
              <span className={`badge ${TYPE_BADGE[selected.type] || 'status-pending'} text-xs capitalize flex-shrink-0`}>{selected.type}</span>
            </div>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              {formatDate(selected.start_at, 'long')} · {new Date(selected.start_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} - {new Date(selected.end_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {selected.location && <p className="text-sm text-[var(--color-text-secondary)] mb-1">{selected.location}</p>}
            {selected.meeting_link && <a href={selected.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-accent)] hover:underline block mb-1">{selected.meeting_link}</a>}
            {selected.description && <p className="text-sm text-[var(--color-text-secondary)] mt-3">{selected.description}</p>}

            {selected.attendees?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">Attendees</div>
                <div className="flex flex-col gap-1">
                  {selected.attendees.map(a => (
                    <div key={a.id} className="text-sm text-[var(--color-text-secondary)] flex items-center justify-between">
                      <span>{a.team_member?.full_name || a.profile?.full_name || a.external_name || a.external_email}</span>
                      <span className={`badge text-xs ${a.notified_at ? 'status-active' : 'status-pending'}`}>{a.notified_at ? 'Notified' : 'Pending'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => cancelEvent(selected.id)} className="btn btn-ghost text-red-500 gap-2 text-sm flex-1">
                <Trash2 className="w-4 h-4" /> Cancel Meeting
              </button>
              <button onClick={() => setSelected(null)} className="btn btn-ghost flex-1 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
