'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Scale, Lock, LayoutGrid, Rows3 } from 'lucide-react'
import { formatDate, MATTER_TYPES } from '@/lib/utils'
import { STAGES } from '@/lib/matterLifecycle'
import { litigationStatusLabel } from '@/lib/litigationStatus'
import { KENYA_COUNTIES } from '@/lib/kenyaCounties'
import toast from 'react-hot-toast'
import {
  PageHeader, Modal, DataTable, StatusPill, EmptyState, LoadingState,
  SearchInput, type Column, type Tone,
} from '@/components/admin/ui'

interface LegalMatter {
  id: string
  matter_number: string
  title: string
  type: string
  status: string
  client_name: string
  court?: string
  case_number?: string
  description?: string
  litigation_status?: string
  is_confidential: boolean
  opening_date: string
  updated_at?: string
  assigned_attorney?: { full_name: string }
}

const ACTIVE_STAGES = ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending', 'open', 'on_hold']

// Health is derived from real activity, not asserted: an active matter
// nobody has touched in 7 days is drifting; in 14, it's stalled.
function matterHealth(m: LegalMatter): { label: string; tone: Tone } | null {
  if (!ACTIVE_STAGES.includes(m.status) || !m.updated_at) return null
  const days = (Date.now() - new Date(m.updated_at).getTime()) / 86400000
  if (days > 14) return { label: 'Stalled', tone: 'overdue' }
  if (days > 7) return { label: 'At risk', tone: 'risk' }
  return { label: 'On track', tone: 'safe' }
}

// Stage drives the pill colour so the list reads by urgency rather than by
// a per-stage palette nobody can hold in their head.
function stageTone(stage: string): Tone {
  if (stage === 'closed' || stage === 'archived') return 'done'
  if (stage === 'on_hold') return 'risk'
  if (stage === 'lead' || stage === 'conflict_check') return 'review'
  return 'safe'
}

const EMPTY_MATTER = { title: '', type: 'civil_litigation', client_name: '', description: '', is_confidential: false, county: '', claim_value: '' }

export default function AdminMattersPage() {
  const [matters, setMatters] = useState<LegalMatter[]>([])
  // Cards are the brief's pattern and the default; the table is kept
  // because it is genuinely better for scanning a long list at density,
  // and removing a working view to satisfy a layout note would be a
  // downgrade for whoever works this screen all day.
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [total, setTotal] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newMatter, setNewMatter] = useState(EMPTY_MATTER)
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [stageAvgDays, setStageAvgDays] = useState<Record<string, number>>({})

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (type !== 'all') params.set('type', type)
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    // /api/team was fetched here on every filter change and the result was
    // never read, so each keystroke cost an extra round trip for nothing.
    fetch(`/api/files/matters?${params}`)
      .then(r => r.json())
      .then(data => {
        setMatters(data.data || [])
        setTotal(data.count || 0)
      })
      .finally(() => setLoading(false))
  }

  function loadStageCounts() {
    fetch('/api/files/matters?counts=stages')
      .then((r) => r.json())
      .then((d) => {
        setStageCounts(d?.counts || {})
        setStageAvgDays(d?.avgDays || {})
      })
  }

  useEffect(() => { load() }, [type, status])
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { loadStageCounts() }, [])

  async function createMatter() {
    if (!newMatter.title || !newMatter.client_name) { toast.error('Title and client name required'); return }
    setCreating(true)
    try {
      const { county, claim_value, ...rest } = newMatter
      const payload: Record<string, unknown> = { ...rest }
      if (county) payload.county = county
      if (claim_value) payload.claim_value = Number(claim_value)
      const res = await fetch('/api/files/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Matter opened')
        setShowCreate(false)
        setNewMatter(EMPTY_MATTER)
        load()
        loadStageCounts()
      } else toast.error('Creation failed')
    } finally { setCreating(false) }
  }

  const columns: Column<LegalMatter>[] = [
    {
      label: 'Matter No.',
      render: m => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-[var(--color-text-primary)] font-semibold">{m.matter_number}</span>
          {m.is_confidential && <Lock className="w-3 h-3 text-[var(--color-text-muted)]" aria-label="Confidential" />}
        </div>
      ),
    },
    {
      label: 'Title / Client',
      render: m => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-primary)] line-clamp-1">{m.title}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{m.client_name}</div>
        </div>
      ),
    },
    { label: 'Type', secondary: true, render: m => MATTER_TYPES.find(t => t.value === m.type)?.label || m.type },
    {
      label: 'Status',
      render: m => <StatusPill tone={stageTone(m.status)}>{STAGES.find(s => s.key === m.status)?.label || m.status}</StatusPill>,
    },
    {
      label: 'Health',
      render: m => {
        const h = matterHealth(m)
        return h ? <StatusPill tone={h.tone} dot>{h.label}</StatusPill> : <span className="opacity-50">-</span>
      },
    },
    {
      label: 'Attorney',
      secondary: true,
      render: m => m.assigned_attorney?.full_name || <StatusPill tone="risk">Unassigned</StatusPill>,
    },
    {
      label: 'Last Activity',
      secondary: true,
      render: m => formatDate(m.updated_at || m.opening_date, 'short'),
    },
    {
      label: '',
      className: 'w-12 text-right',
      render: m => (
        <Link href={`/admin/matters/${m.id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Open matter">
          <Eye className="w-4 h-4" />
        </Link>
      ),
    },
  ]

  const emptyState = (
    <EmptyState
      icon={Scale}
      title={search || type !== 'all' || status !== 'all' ? 'No matters match those filters' : 'No matters yet'}
      description={search || type !== 'all' || status !== 'all' ? 'Clear the search, or pick a different type or stage.' : 'Open the first matter to start the pipeline.'}
      action={!search && type === 'all' && status === 'all' && (
        <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Open New Matter
        </button>
      )}
    />
  )

  return (
    <div>
      <PageHeader
        icon={Scale}
        eyebrow="Matters"
        title="Legal Matters"
        meta={[`${total} on record`, status !== 'all' ? STAGES.find(s => s.key === status)?.label : null]}
        actions={
          <>
            <div className="matter-view-toggle" role="group" aria-label="View">
              <button onClick={() => setView('cards')} className={view === 'cards' ? 'is-active' : ''} aria-pressed={view === 'cards'}>
                <LayoutGrid className="w-3.5 h-3.5" /> Cards
              </button>
              <button onClick={() => setView('table')} className={view === 'table' ? 'is-active' : ''} aria-pressed={view === 'table'}>
                <Rows3 className="w-3.5 h-3.5" /> Table
              </button>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Open New Matter
            </button>
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search matter, client, number…" className="max-w-sm" />
        <select value={type} onChange={e => setType(e.target.value)} className="input w-48 text-sm">
          <option value="all">All Types</option>
          {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input w-40 text-sm">
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </PageHeader>

      {/* Stage counts double as the stage filter: clicking one narrows the
          list below, clicking it again clears. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {STAGES.map((s) => {
          const active = status === s.key
          const count = stageCounts[s.key] ?? 0
          return (
            <button
              key={s.key}
              onClick={() => setStatus(active ? 'all' : s.key)}
              aria-pressed={active}
              className={`card px-3 py-2.5 text-left transition-all border-l-[3px] ${active ? '' : 'border-l-transparent'} ${count === 0 ? 'opacity-50' : ''}`}
              style={active ? { borderLeftColor: 'var(--color-brand)' } : undefined}
            >
              <div className="font-display text-xl font-semibold text-[var(--color-text-primary)] tabular-nums leading-none">{count}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">{s.label}</div>
              {stageAvgDays[s.key] !== undefined && count > 0 && (
                <div className="text-[0.62rem] text-[var(--color-text-muted)] opacity-70 mt-0.5">avg {stageAvgDays[s.key]}d in stage</div>
              )}
            </button>
          )
        })}
      </div>

      {view === 'table' ? (
        <DataTable
          caption="Legal matters"
          columns={columns}
          rows={matters}
          rowKey={m => m.id}
          loading={loading}
          empty={emptyState}
        />
      ) : loading ? (
        <LoadingState />
      ) : matters.length === 0 ? (
        emptyState
      ) : (
        /* The summary shown here is the matter's own human-written
           description and is deliberately not badged as AI-generated. */
        <div className="matter-card-list">
          {matters.map(matter => {
            const health = matterHealth(matter)
            return (
              <Link key={matter.id} href={`/admin/matters/${matter.id}`} className="matter-card">
                <div className="matter-card-head">
                  <div className="min-w-0">
                    <div className="matter-card-number">
                      {matter.matter_number}
                      {matter.is_confidential && <Lock className="w-3 h-3" />}
                    </div>
                    <h3 className="matter-card-title">{matter.title}</h3>
                  </div>
                  {health && <StatusPill tone={health.tone} dot>{health.label}</StatusPill>}
                </div>

                <div className="matter-card-pills">
                  <StatusPill>{MATTER_TYPES.find(m => m.value === matter.type)?.label || matter.type}</StatusPill>
                  <StatusPill tone={stageTone(matter.status)}>
                    {STAGES.find(s => s.key === matter.status)?.label || matter.status}
                  </StatusPill>
                  {matter.litigation_status && <StatusPill>{litigationStatusLabel(matter.litigation_status)}</StatusPill>}
                </div>

                <dl className="matter-card-meta">
                  <div><dt>Client</dt><dd>{matter.client_name}</dd></div>
                  <div><dt>Court</dt><dd>{matter.court || 'Not filed'}</dd></div>
                  <div><dt>Attorney</dt><dd>{matter.assigned_attorney?.full_name || 'Unassigned'}</dd></div>
                  {matter.case_number && <div><dt>Case No.</dt><dd>{matter.case_number}</dd></div>}
                </dl>

                {matter.description && <p className="matter-card-summary">{matter.description}</p>}
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Open New Matter"
        description="Opens at the first stage of the pipeline. Conflict check comes next."
        footer={
          <>
            <button onClick={createMatter} disabled={creating} className="btn btn-primary flex-1">
              {creating ? 'Opening…' : 'Open Matter'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Matter Title *</label>
          <input className="input text-sm" value={newMatter.title} onChange={e => setNewMatter(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Mwangi v. Kamau, Contract Dispute" />
        </div>
        <div>
          <label className="label">Client Name *</label>
          <input className="input text-sm" value={newMatter.client_name} onChange={e => setNewMatter(f => ({ ...f, client_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Matter Type</label>
          <select className="input text-sm" value={newMatter.type} onChange={e => setNewMatter(f => ({ ...f, type: e.target.value }))}>
            {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input text-sm" value={newMatter.description} onChange={e => setNewMatter(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">County</label>
            <select className="input text-sm" value={newMatter.county} onChange={e => setNewMatter(f => ({ ...f, county: e.target.value }))}>
              <option value="">Not set</option>
              {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Claim Value (Ksh)</label>
            <input type="number" className="input text-sm" placeholder="Optional" value={newMatter.claim_value} onChange={e => setNewMatter(f => ({ ...f, claim_value: e.target.value }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={newMatter.is_confidential} onChange={e => setNewMatter(f => ({ ...f, is_confidential: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Mark as Confidential</span>
        </label>
      </Modal>
    </div>
  )
}
