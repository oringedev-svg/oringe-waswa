'use client'
import { useEffect, useState } from 'react'
import { Send, Loader2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { SERVICE_LOCATION_TIERS, daysRemaining, locationTierMeta } from '@/lib/serviceOfProcess'
import SectionCard from '@/components/admin/SectionCard'

interface ServiceRecord {
  id: string
  recipient_name: string
  recipient_role: string | null
  location_tier: string
  method: string | null
  served_at: string
  response_due_date: string
  status: 'awaiting_response' | 'responded' | 'escalated'
  response_note: string | null
  document?: { id: string; title: string } | null
  document_description: string | null
}

interface MatterDocument {
  id: string
  title: string
}

export default function ServiceOfProcessCard({ matterId, documents, permitted, invoked, onData }: {
  matterId: string
  documents: MatterDocument[]
  permitted: boolean
  // Result, not process: this card stays out of sight until there's real
  // service history, or the matter page invokes it as a stage-related task.
  invoked: boolean
  onData?: (hasRecords: boolean) => void
}) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(invoked)
  const [saving, setSaving] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    recipient_name: '',
    recipient_role: '',
    location_tier: 'within_town',
    method: '',
    document_id: '',
    served_at: new Date().toISOString().slice(0, 10),
  })

  function load() {
    setLoading(true)
    fetch(`/api/service-of-process?matter_id=${matterId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setRecords(list)
        onData?.(list.length > 0)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [matterId])
  useEffect(() => { if (invoked) setShowForm(true) }, [invoked])

  async function logService() {
    if (!form.recipient_name.trim()) { toast.error('Recipient name is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/service-of-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, ...form, document_id: form.document_id || undefined }),
      })
      if (res.ok) {
        toast.success('Service logged, a diary task was created for the response deadline')
        setShowForm(false)
        setForm({ recipient_name: '', recipient_role: '', location_tier: 'within_town', method: '', document_id: '', served_at: new Date().toISOString().slice(0, 10) })
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not log service')
      }
    } finally {
      setSaving(false)
    }
  }

  async function resolve(id: string, status: 'responded' | 'escalated') {
    setResolvingId(id)
    try {
      const res = await fetch(`/api/service-of-process/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, response_note: noteDraft[id] || '' }),
      })
      if (res.ok) { toast.success(status === 'responded' ? 'Marked responded' : 'Marked escalated'); load() }
      else toast.error('Could not update')
    } finally {
      setResolvingId(null)
    }
  }

  const overdueCount = records.filter((r) => r.status === 'awaiting_response' && daysRemaining(r.response_due_date) < 0).length

  // Nothing to show and nobody asked to log anything, stay out of the way
  // rather than displaying an empty section for a stage-related task that
  // hasn't been invoked.
  if (!loading && records.length === 0 && !invoked) return null

  return (
    <SectionCard
      title="Service of Process"
      icon={Send}
      color="red"
      defaultOpen={overdueCount > 0}
      badge={overdueCount > 0 ? <span className="badge status-rejected text-xs ml-1">{overdueCount} overdue</span> : undefined}
      headerExtra={permitted ? (
        <button onClick={() => setShowForm((v) => !v)} className="btn btn-outline gap-2 text-sm">
          <Plus className="w-4 h-4" /> Log Service
        </button>
      ) : undefined}
    >
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        The response deadline is set by where the recipient is: within town (7 days), outside town (14 days), or outside the country (21 days). Logging a service auto-creates a diary task due on that date.
      </p>

      {showForm && (
        <div className="flex flex-col gap-2 mb-4 p-3 rounded-md bg-[var(--color-surface-overlay)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Recipient name" value={form.recipient_name} onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))} />
            <input className="input text-sm" placeholder="Role (e.g. Defendant)" value={form.recipient_role} onChange={(e) => setForm((f) => ({ ...f, recipient_role: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select className="input text-sm" value={form.location_tier} onChange={(e) => setForm((f) => ({ ...f, location_tier: e.target.value }))}>
              {SERVICE_LOCATION_TIERS.map((t) => <option key={t.key} value={t.key}>{t.label} ({t.days}d)</option>)}
            </select>
            <input className="input text-sm" placeholder="Method (e.g. Process server)" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} />
            <input type="date" className="input text-sm" value={form.served_at} onChange={(e) => setForm((f) => ({ ...f, served_at: e.target.value }))} />
          </div>
          {documents.length > 0 && (
            <select className="input text-sm" value={form.document_id} onChange={(e) => setForm((f) => ({ ...f, document_id: e.target.value }))}>
              <option value="">Document served (optional)</option>
              {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          )}
          <button onClick={logService} disabled={saving} className="btn btn-primary text-sm gap-2 self-start">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Log Service
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" /></div>
      ) : records.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No service has been logged on this matter yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => {
            const remaining = daysRemaining(r.response_due_date)
            const overdue = r.status === 'awaiting_response' && remaining < 0
            return (
              <div key={r.id} className="p-3 rounded-lg bg-[var(--color-surface-overlay)]">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {r.recipient_name}{r.recipient_role ? ` (${r.recipient_role})` : ''}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {locationTierMeta(r.location_tier).label} · served {formatDate(r.served_at, 'short')}
                      {r.method ? ` via ${r.method}` : ''}
                      {(r.document?.title || r.document_description) ? ` · ${r.document?.title || r.document_description}` : ''}
                    </div>
                  </div>
                  {r.status === 'awaiting_response' ? (
                    <span className={`badge text-xs flex items-center gap-1 flex-shrink-0 ${overdue ? 'status-rejected' : 'status-pending'}`}>
                      {overdue && <AlertTriangle className="w-3 h-3" />}
                      {overdue ? `Overdue ${Math.abs(remaining)}d` : `Due in ${remaining}d`}
                    </span>
                  ) : (
                    <span className={`badge text-xs flex-shrink-0 ${r.status === 'escalated' ? 'status-rejected' : 'status-active'}`}>
                      {r.status === 'escalated' ? 'Escalated' : 'Responded'}
                    </span>
                  )}
                </div>

                {r.status === 'awaiting_response' && permitted && (
                  <div className="flex flex-wrap gap-2 items-center mt-2 pt-2 border-t border-[var(--color-border)]">
                    <input
                      className="input text-xs flex-1 min-w-40"
                      placeholder="Note (optional)"
                      value={noteDraft[r.id] || ''}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <button onClick={() => resolve(r.id, 'responded')} disabled={resolvingId === r.id} className="btn btn-outline text-xs gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Responded
                    </button>
                    <button onClick={() => resolve(r.id, 'escalated')} disabled={resolvingId === r.id} className="btn btn-ghost text-xs text-red-500">
                      No Response, Escalate
                    </button>
                  </div>
                )}
                {r.response_note && r.status !== 'awaiting_response' && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--color-border)]">{r.response_note}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
