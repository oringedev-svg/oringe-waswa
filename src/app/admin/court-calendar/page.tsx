'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Gavel, MapPin, X, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { litigationStatusLabel, litigationStatusMeta } from '@/lib/litigationStatus'

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
    fetch('/api/matters?limit=200')
      .then(r => r.json())
      .then(d => setMatters(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => {})
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
      <div className="card p-12 text-center">
        <Gavel className="w-8 h-8 mx-auto mb-3 text-[var(--color-muted)]" />
        <h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mb-2">Court calendar not set up yet</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          Run migration <code>025_courts_and_litigation.sql</code> to add the courts register and litigation tracking
          that this calendar reads from.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Court Calendar</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Every upcoming appearance across all matters, with the court and case number attached.
          </p>
        </div>
        <button onClick={() => setForm({ matter_id: '', title: 'Mention', start_at: '', location: '', description: '' })}
          className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Log a court date
        </button>
      </div>

      <div className="flex gap-0 border-b border-[var(--color-border)] mb-6">
        {(['upcoming', 'past'] as const).map(s => (
          <button key={s} onClick={() => setScope(s)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              scope === s ? 'border-[var(--color-brand)] text-[var(--color-text-primary)]' : 'border-transparent text-[var(--color-text-muted)]'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : dates.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarDays className="w-7 h-7 mx-auto mb-3 text-[var(--color-muted)]" />
          <p className="text-[var(--color-text-muted)] text-sm">
            {scope === 'upcoming' ? 'No upcoming court dates.' : 'No past court dates on record.'}
          </p>
        </div>
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
                    {meta && <span className="badge text-[0.65rem]">{litigationStatusLabel(d.matter!.litigation_status)}</span>}
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
                  <button onClick={() => cancelDate(d.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-muted)] flex-shrink-0" title="Mark vacated">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setForm(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Log a court date</h2>
              <button onClick={() => setForm(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Matter *</label>
                <select className="input text-sm" value={form.matter_id} onChange={e => setForm({ ...form, matter_id: e.target.value })}>
                  <option value="">Select matter…</option>
                  {matters.map(m => (
                    <option key={m.id} value={m.id}>{m.matter_number} · {m.title}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  The court comes from the matter itself, set it on the matter so it is never typed twice.
                </p>
              </div>
              <div>
                <label className="label">Attendance type</label>
                <select className="input text-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}>
                  {['Mention', 'Hearing', 'Ruling', 'Judgment', 'Pre-trial conference', 'Application', 'Taxation', 'Mediation'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date and time *</label>
                <input type="datetime-local" className="input text-sm" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div>
                <label className="label">Court room / registry (optional)</label>
                <input className="input text-sm" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Court 12, before Hon. …" />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea rows={2} className="input text-sm" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Log date
              </button>
              <button onClick={() => setForm(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
