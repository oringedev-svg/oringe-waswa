'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Scale, Lock, LayoutGrid, Rows3, AlertTriangle, TrendingUp, Users, Activity } from 'lucide-react'
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

interface PracticeArea { id: string; title: string; top_level_category?: string }
interface MatterTypeReference { id: string; practice_area_id: string; name: string; decided_default: boolean }

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

function stageTone(stage: string): Tone {
  if (stage === 'closed' || stage === 'archived') return 'done'
  if (stage === 'on_hold') return 'risk'
  if (stage === 'lead' || stage === 'conflict_check') return 'review'
  return 'safe'
}

const EMPTY_MATTER = { title: '', type: 'civil_litigation', client_name: '', description: '', is_confidential: false, county: '', claim_value: '', practice_area_id: '', practice_area_ids: [] as string[], matter_type_id: '', engagement_objective: '' }

// Stage funnel chip — click to filter
function StageChip({
  label, count, avgDays, active, onClick,
}: {
  label: string; count: number; avgDays?: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-start px-3.5 py-3 rounded-xl border text-left transition-all"
      style={{
        background: active
          ? 'color-mix(in srgb, var(--color-brand) 8%, var(--color-surface))'
          : 'var(--color-surface)',
        borderColor: active
          ? 'color-mix(in srgb, var(--color-brand) 35%, transparent)'
          : 'var(--color-border)',
        opacity: count === 0 ? 0.45 : 1,
        boxShadow: active ? '0 0 0 1px color-mix(in srgb, var(--color-brand) 25%, transparent)' : undefined,
      }}
    >
      <span
        className="text-2xl font-semibold tabular-nums leading-none mb-1"
        style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-primary)' }}
      >
        {count}
      </span>
      <span className="text-[0.7rem] text-[var(--color-text-muted)] truncate w-full">{label}</span>
      {avgDays !== undefined && count > 0 && (
        <span className="text-[0.62rem] text-[var(--color-text-muted)] opacity-60 mt-0.5">avg {avgDays}d</span>
      )}
    </button>
  )
}

export default function AdminMattersPage() {
  const [matters, setMatters] = useState<LegalMatter[]>([])
  // Cards are the brief's pattern and the default; the table is kept
  // because it is genuinely better for scanning a long list at density.
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
  const [practiceAreas, setPracticeAreas] = useState<PracticeArea[]>([])
  const [referenceTypes, setReferenceTypes] = useState<MatterTypeReference[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    const params = new URLSearchParams({ limit: '30' })
    if (type !== 'all') params.set('type', type)
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    fetch(`/api/files/matters?${params}`, { cache: 'no-store' })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body: data }) => {
        if (!ok) {
          setLoadError(data?.error || 'Unable to load matters. Please try again.')
          return
        }
        setMatters(data.data || [])
        setTotal(data.count || 0)
      })
      .catch(() => setLoadError('Unable to reach the matter register. Please try again.'))
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
  useEffect(() => {
    fetch('/api/matter-reference').then(r => r.ok ? r.json() : null).then(data => {
      if (data) { setPracticeAreas(data.areas || []); setReferenceTypes(data.types || []) }
    })
  }, [])

  async function createMatter() {
    if (!newMatter.title || !newMatter.client_name || (practiceAreas.length > 0 && !newMatter.practice_area_id)) {
      toast.error(practiceAreas.length > 0 ? 'Title, client name and a primary practice area are required' : 'Title and client name are required')
      return
    }
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

  // Derive headline KPIs from stage counts
  const activeCount = ACTIVE_STAGES.reduce((sum, key) => sum + (stageCounts[key] ?? 0), 0)
  const stalledCount = matters.filter(m => matterHealth(m)?.label === 'Stalled').length
  const unassigned = matters.filter(m => !m.assigned_attorney).length

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
        <select value={type} onChange={e => setType(e.target.value)} className="input w-44 text-sm">
          <option value="all">All Types</option>
          {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input w-36 text-sm">
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </PageHeader>

      {/* Headline KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-raised)] flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums leading-none text-[var(--color-text-primary)]">{activeCount}</div>
            <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5">Active matters</div>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            background: stalledCount > 0 ? 'color-mix(in srgb, var(--status-danger) 6%, var(--color-surface))' : 'var(--color-surface)',
            borderColor: stalledCount > 0 ? 'color-mix(in srgb, var(--status-danger) 20%, transparent)' : 'var(--color-border)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: stalledCount > 0 ? 'color-mix(in srgb, var(--status-danger) 12%, transparent)' : 'var(--color-surface-raised)' }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: stalledCount > 0 ? 'var(--status-danger)' : 'var(--color-text-muted)' }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color: stalledCount > 0 ? 'var(--status-danger)' : 'var(--color-text-primary)' }}>{stalledCount}</div>
            <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5">Stalled (&gt;14d)</div>
          </div>
        </div>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{
            background: unassigned > 0 ? 'color-mix(in srgb, var(--status-warning) 6%, var(--color-surface))' : 'var(--color-surface)',
            borderColor: unassigned > 0 ? 'color-mix(in srgb, var(--status-warning) 20%, transparent)' : 'var(--color-border)',
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: unassigned > 0 ? 'color-mix(in srgb, var(--status-warning) 12%, transparent)' : 'var(--color-surface-raised)' }}
          >
            <Users className="w-4 h-4" style={{ color: unassigned > 0 ? 'var(--status-warning)' : 'var(--color-text-muted)' }} />
          </div>
          <div>
            <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color: unassigned > 0 ? 'var(--status-warning)' : 'var(--color-text-primary)' }}>{unassigned}</div>
            <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5">Unassigned</div>
          </div>
        </div>
      </div>

      {/* Stage funnel — clicking narrows the list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {STAGES.map((s) => (
          <StageChip
            key={s.key}
            label={s.label}
            count={stageCounts[s.key] ?? 0}
            avgDays={stageAvgDays[s.key]}
            active={status === s.key}
            onClick={() => setStatus(status === s.key ? 'all' : s.key)}
          />
        ))}
      </div>

      {loadError && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={load} className="btn btn-ghost text-sm">Try again</button>
        </div>
      )}

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
          <label className="label">Primary Practice Area {practiceAreas.length > 0 && '*'}</label>
          <select className="input text-sm" value={newMatter.practice_area_id} disabled={practiceAreas.length === 0} onChange={e => setNewMatter(f => ({ ...f, practice_area_id: e.target.value, practice_area_ids: Array.from(new Set([e.target.value, ...f.practice_area_ids])).filter(Boolean), matter_type_id: '' }))}>
            <option value="">Select a practice area</option>
            {practiceAreas.map(area => <option key={area.id} value={area.id}>{area.title}</option>)}
          </select>
        </div>
        {practiceAreas.length > 0 && <div>
          <label className="label">Additional Practice Areas <span className="text-[var(--color-text-muted)]">(select every area the matter touches)</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto rounded-lg border border-[var(--color-border)] p-3">
            {practiceAreas.filter(area => area.id !== newMatter.practice_area_id).map(area => (
              <label key={area.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newMatter.practice_area_ids.includes(area.id)} onChange={e => setNewMatter(f => ({ ...f, practice_area_ids: e.target.checked ? [...f.practice_area_ids, area.id] : f.practice_area_ids.filter(id => id !== area.id) }))} />
                {area.title}
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Conflict checks must clear every selected practice area.</p>
        </div>}
        <div>
          <label className="label">Matter Type</label>
          {practiceAreas.length > 0 ? (
            <select className="input text-sm" value={newMatter.matter_type_id} disabled={!newMatter.practice_area_id} onChange={e => setNewMatter(f => ({ ...f, matter_type_id: e.target.value }))}>
              <option value="">Select a matter type</option>
              {referenceTypes.filter(t => t.practice_area_id === newMatter.practice_area_id).map(t => <option key={t.id} value={t.id}>{t.name}{t.decided_default ? ' (standard)' : ''}</option>)}
            </select>
          ) : (
            <select className="input text-sm" value={newMatter.type} onChange={e => setNewMatter(f => ({ ...f, type: e.target.value }))}>
              {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          )}
          {!practiceAreas.length && <p className="text-xs text-[var(--color-text-muted)] mt-1">Using the standard matter form while reference data is unavailable.</p>}
        </div>
        <div>
          <label className="label">Engagement objective <span className="text-[var(--color-text-muted)]">(optional)</span></label>
          <input className="input text-sm" value={newMatter.engagement_objective} onChange={e => setNewMatter(f => ({ ...f, engagement_objective: e.target.value }))} placeholder="Leave blank for a single-matter engagement" />
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
