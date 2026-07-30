'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Gavel, MapPin, X, CalendarDays } from 'lucide-react'
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
function daysAway(v: string) {
  const diff = Math.ceil((new Date(v).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `in ${diff}d`
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
    // This hit /api/matters, which has no collection route (only
    // /api/matters/[id]), so it 404'd on every load and the empty .catch
    // swallowed it. The matter dropdown was therefore always empty and the
    // form could never be submitted. The list lives at /api/files/matters.
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

  return (
    <div>
      <PageHeader
        icon={Gavel}
        eyebrow="Court and deadlines"
        title="Court Calendar"
        description="Every upcoming appearance across all matters, with the court and case number attached."
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

      {loading ? (
        <LoadingState />
      ) : dates.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={scope === 'upcoming' ? 'No upcoming court dates' : 'No past court dates on record'}
          description={scope === 'upcoming' ? 'Log an appearance and it will appear here, sorted by date.' : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {dates.map(d => {
            const meta = d.matter ? litigationStatusMeta(d.matter.litigation_status) : null
            return (
              <div key={d.id} className="court-date-card">
                <div className="court-date-when">
                  <span className="court-date-day">{new Date(d.start_at).getDate()}</span>
                  <span className="court-date-month">{new Date(d.start_at).toLocaleDateString('en-GB', { month: 'short' })}</span>
                  <span className="court-date-away">{daysAway(d.start_at)}</span>
                </div>

                <div className="court-date-body">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="court-date-title">{d.title}</span>
                    {meta && <StatusPill>{litigationStatusLabel(d.matter!.litigation_status)}</StatusPill>}
                  </div>

                  {d.matter && (
                    <Link href={`/admin/matters/${d.matter.id}`} className="court-date-matter">
                      {d.matter.matter_number} · {d.matter.title}
                      {d.matter.case_number ? ` · Case ${d.matter.case_number}` : ''}
                    </Link>
                  )}

                  <div className="court-date-meta">
                    <span>{fmtDate(d.start_at)} at {fmtTime(d.start_at)}</span>
                    {d.court && (
                      <span className="inline-flex items-center gap-1">
                        <Gavel className="w-3.5 h-3.5" />
                        {d.court.name}{d.court.station ? `, ${d.court.station}` : ''}
                      </span>
                    )}
                    {d.location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{d.location}</span>
                    )}
                  </div>
                  {d.description && <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">{d.description}</p>}
                </div>

                {scope === 'upcoming' && (
                  <button onClick={() => cancelDate(d.id)} className="btn btn-ghost p-1.5 !px-1.5 flex-shrink-0" title="Mark vacated">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
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
          {/* An empty dropdown with no explanation is what made this screen
              look broken rather than merely unpopulated. */}
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
