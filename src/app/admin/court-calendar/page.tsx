'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Gavel, MapPin, X, CalendarDays, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { litigationStatusLabel, litigationStatusMeta } from '@/lib/litigationStatus'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState, SetupRequired, FilterTabs,
} from '@/components/admin/ui'

interface CourtDate {
  id: string
  title: string
  description?: string
  start_at: string
  location?: string
  status: string
  matter?: {
    id: string
    matter_number: string
    title: string
    client_name: string
    case_number?: string
    litigation_status: string
  } | null
  court?: { id: string; name: string; station?: string } | null
}

interface MatterOption {
  id: string
  matter_number: string
  title: string
  client_name: string
}

const ATTENDANCE_TYPES = ['Mention', 'Hearing', 'Ruling', 'Judgment', 'Pre-trial conference', 'Application', 'Taxation', 'Mediation']

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(v: string) {
  return new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function daysAway(v: string): { label: string; urgent: boolean; past: boolean } {
  const diff = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d ago`, urgent: false, past: true }
  if (diff === 0) return { label: 'Today', urgent: true, past: false }
  if (diff === 1) return { label: 'Tomorrow', urgent: true, past: false }
  if (diff <= 3) return { label: `in ${diff}d`, urgent: true, past: false }
  return { label: `in ${diff}d`, urgent: false, past: false }
}

export default function CourtCalendarPage() {
  const [dates, setDates] = useState<CourtDate[]>([])
  const [matters, setMatters] = useState<MatterOption[]>([])
  const [mattersError, setMattersError] = useState(false)
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [form, setForm] = useState<{ matter_id: string; title: string; start_at: string; location: string; description: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetch(`/api/court-dates?scope=${scope}`)
      .then(async r => {
        if (!r.ok) { setMissing(r.status === 500); return [] }
        setMissing(false)
        return r.json()
      })
      .then(d => setDates(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [scope])

  useEffect(() => {
    fetch('/api/files/matters?limit=200')
      .then(r => {
        if (!r.ok) throw new Error(`matters ${r.status}`)
        return r.json()
      })
      .then(d => {
        setMatters(Array.isArray(d) ? d : d?.data ?? [])
        setMattersError(false)
      })
      .catch(() => setMattersError(true))
  }, [])

  async function save() {
    if (!form?.matter_id) { toast.error('Choose the matter this date belongs to'); return }
    if (!form?.start_at) { toast.error('Set the date'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/court-dates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.ok) { toast.success('Court date logged'); setForm(null); load() }
      else toast.error((await res.json()).error || 'Could not log the date')
    } finally { setSaving(false) }
  }

  async function cancelDate(id: string) {
    if (!confirm('Mark this appearance as vacated? It stays on the matter history.')) return
    const res = await fetch(`/api/court-dates?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Marked vacated'); load() } else toast.error('Failed')
  }

  if (missing) {
    return (
      <SetupRequired icon={Gavel} title="Court calendar not set up yet" migration="025_courts_and_litigation.sql">
        The courts register and litigation tracking this calendar reads from have not been created.
      </SetupRequired>
    )
  }

  // Group dates by month for the upcoming view
  const grouped: Record<string, CourtDate[]> = {}
  if (scope === 'upcoming') {
    dates.forEach(d => {
      const key = new Date(d.start_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(d)
    })
  }

  const urgentCount = dates.filter(d => {
    const diff = Math.ceil((new Date(d.start_at).getTime() - Date.now()) / 86400000)
    return diff >= 0 && diff <= 3
  }).length

  return (
    <div>
      <PageHeader
        icon={Gavel}
        eyebrow="Court and deadlines"
        title="Court Calendar"
        meta={[`${dates.length} ${scope}`]}
        actions={
          <button
            onClick={() => setForm({ matter_id: '', title: 'Mention', start_at: '', location: '', description: '' })}
            className="btn btn-primary gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Log a court date
          </button>
        }
      >
        <FilterTabs
          value={scope}
          onChange={setScope}
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
        />
      </PageHeader>

      {/* Urgency callout — only when upcoming dates are close */}
      {scope === 'upcoming' && urgentCount > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-6"
          style={{
            background: 'color-mix(in srgb, var(--status-warning) 8%, var(--color-surface))',
            borderColor: 'color-mix(in srgb, var(--status-warning) 25%, transparent)',
          }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--status-warning)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--status-warning)' }}>
            {urgentCount} appearance{urgentCount > 1 ? 's' : ''} within the next 3 days
          </span>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : dates.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={scope === 'upcoming' ? 'No upcoming court dates' : 'No past court dates on record'}
          description={scope === 'upcoming' ? 'Log an appearance and it will appear here, sorted by date.' : undefined}
        />
      ) : scope === 'upcoming' ? (
        /* Grouped monthly view for upcoming */
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([month, monthDates]) => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{month}</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{monthDates.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {monthDates.map(d => <CourtCard key={d.id} d={d} scope={scope} onCancel={cancelDate} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {dates.map(d => <CourtCard key={d.id} d={d} scope={scope} onCancel={cancelDate} />)}
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="Log a court date"
        footer={
          <>
            <button onClick={save} disabled={saving || !matters.length} className="btn btn-primary flex-1">
              {saving ? 'Logging...' : 'Log date'}
            </button>
            <button onClick={() => setForm(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Matter *</label>
          <select
            className="input text-sm"
            value={form?.matter_id || ''}
            disabled={!matters.length}
            onChange={e => form && setForm({ ...form, matter_id: e.target.value })}
          >
            <option value="">{matters.length ? 'Select matter...' : 'No matters available'}</option>
            {matters.map(m => (
              <option key={m.id} value={m.id}>{m.matter_number} · {m.title}</option>
            ))}
          </select>
          {mattersError ? (
            <p className="text-xs mt-1.5 text-[var(--status-danger)]">
              Could not load the matter list. Reload the page, and check you are still signed in.
            </p>
          ) : !matters.length ? (
            <p className="text-xs mt-1.5 text-[var(--color-text-muted)]">
              No matters on record yet. Open a matter first, then log its court dates here.
            </p>
          ) : (
            <p className="text-xs mt-1.5 text-[var(--color-text-muted)]">
              The court comes from the matter itself. Set it on the matter so it is never typed twice.
            </p>
          )}
        </div>
        <div>
          <label className="label">Attendance type</label>
          <select className="input text-sm" value={form?.title || 'Mention'} onChange={e => form && setForm({ ...form, title: e.target.value })}>
            {ATTENDANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date and time *</label>
          <input type="datetime-local" className="input text-sm" value={form?.start_at || ''} onChange={e => form && setForm({ ...form, start_at: e.target.value })} />
        </div>
        <div>
          <label className="label">Court room or registry (optional)</label>
          <input className="input text-sm" value={form?.location || ''} onChange={e => form && setForm({ ...form, location: e.target.value })} placeholder="Court 12" />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea rows={2} className="input text-sm" value={form?.description || ''} onChange={e => form && setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}

// Extracted card for a single court appearance
function CourtCard({ d, scope, onCancel }: { d: CourtDate; scope: string; onCancel: (id: string) => void }) {
  const meta = d.matter ? litigationStatusMeta(d.matter.litigation_status) : null
  const away = daysAway(d.start_at)

  return (
    <div
      className="flex gap-4 p-4 rounded-xl border transition-colors"
      style={{
        background: 'var(--color-surface)',
        borderColor: away.urgent && !away.past
          ? 'color-mix(in srgb, var(--status-warning) 28%, var(--color-border))'
          : 'var(--color-border)',
      }}
    >
      {/* Date column */}
      <div className="flex flex-col items-center text-center w-12 flex-shrink-0 pt-0.5">
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: away.past ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}
        >
          {new Date(d.start_at).getDate()}
        </span>
        <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-text-muted)] mt-0.5">
          {new Date(d.start_at).toLocaleDateString('en-GB', { month: 'short' })}
        </span>
        {/* Countdown chip */}
        <span
          className="mt-2 px-1.5 py-0.5 rounded-md text-[0.6rem] font-semibold tabular-nums"
          style={{
            background: away.past
              ? 'var(--color-surface-raised)'
              : away.urgent
              ? 'color-mix(in srgb, var(--status-warning) 15%, transparent)'
              : 'color-mix(in srgb, var(--color-brand) 10%, transparent)',
            color: away.past
              ? 'var(--color-text-muted)'
              : away.urgent
              ? 'var(--status-warning)'
              : 'var(--color-brand)',
          }}
        >
          {away.label}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px bg-[var(--color-border)] self-stretch flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="font-semibold text-sm text-[var(--color-text-primary)]">{d.title}</span>
          {meta && <StatusPill>{litigationStatusLabel(d.matter!.litigation_status)}</StatusPill>}
        </div>

        {d.matter && (
          <Link href={`/admin/matters/${d.matter.id}`} className="text-xs text-[var(--color-brand)] hover:underline flex items-center gap-1 mb-1.5 w-fit">
            {d.matter.matter_number} · {d.matter.title}
            {d.matter.case_number ? ` · Case ${d.matter.case_number}` : ''}
          </Link>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtDate(d.start_at)} at {fmtTime(d.start_at)}
          </span>
          {d.court && (
            <span className="flex items-center gap-1">
              <Gavel className="w-3 h-3" />
              {d.court.name}{d.court.station ? `, ${d.court.station}` : ''}
            </span>
          )}
          {d.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.location}</span>
          )}
        </div>

        {d.description && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-2 line-clamp-2">{d.description}</p>
        )}
      </div>

      {scope === 'upcoming' && (
        <button
          onClick={() => onCancel(d.id)}
          className="btn btn-ghost p-1.5 !px-1.5 flex-shrink-0 self-start"
          title="Mark vacated"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
