'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Loader2, Scale, Lock, LayoutGrid, Rows3 } from 'lucide-react'
import { formatDate, getStatusColor, MATTER_TYPES } from '@/lib/utils'
import { STAGES } from '@/lib/matterLifecycle'
import { litigationStatusLabel } from '@/lib/litigationStatus'
import { KENYA_COUNTIES } from '@/lib/kenyaCounties'
import toast from 'react-hot-toast'

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
function matterHealth(m: LegalMatter): { label: string; cls: string } | null {
  if (!ACTIVE_STAGES.includes(m.status) || !m.updated_at) return null
  const days = (Date.now() - new Date(m.updated_at).getTime()) / 86400000
  if (days > 14) return { label: 'Stalled', cls: 'status-rejected' }
  if (days > 7) return { label: 'At risk', cls: 'status-pending' }
  return { label: 'On track', cls: 'status-active' }
}

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
  const [newMatter, setNewMatter] = useState({ title: '', type: 'civil_litigation', client_name: '', description: '', is_confidential: false, county: '', claim_value: '' })
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [stageAvgDays, setStageAvgDays] = useState<Record<string, number>>({})

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (type !== 'all') params.set('type', type)
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    Promise.all([
      fetch(`/api/files/matters?${params}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([data, teamData]) => {
      setMatters(data.data || [])
      setTotal(data.count || 0)
      setTeam(teamData || [])
    }).finally(() => setLoading(false))
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
    const { county, claim_value, ...rest } = newMatter
    const payload: Record<string, unknown> = { ...rest }
    if (county) payload.county = county
    if (claim_value) payload.claim_value = Number(claim_value)
    const res = await fetch('/api/files/matters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) { toast.success('Matter created!'); setShowCreate(false); load(); loadStageCounts() }
    else toast.error('Creation failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Legal Matters</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{total} matters on record</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Stage counts, click a stage to filter the table below by it */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(status === s.key ? 'all' : s.key)}
            className={`card px-4 py-2.5 text-left transition-all ${status === s.key ? 'border-[var(--color-accent)]' : ''}`}
          >
            <div className="text-lg font-display font-semibold text-[var(--color-text-primary)]">{stageCounts[s.key] ?? 0}</div>
            <div className="text-xs text-[var(--color-muted)]">{s.label}</div>
            {stageAvgDays[s.key] !== undefined && (stageCounts[s.key] ?? 0) > 0 && (
              <div className="text-[10px] text-[var(--color-muted)] mt-0.5">avg {stageAvgDays[s.key]}d in stage</div>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search matter, client, number…" className="input pl-9 text-sm" />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className="input w-48 text-sm">
          <option value="all">All Types</option>
          {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="input w-36 text-sm">
          <option value="all">All Statuses</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : matters.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No matters found.</div>
      ) : view === 'cards' ? (
        /* Matter card pattern from the Entrora UI brief (§2): title, small
           status pills for type and stage, a compact client/court metadata
           row, and the case summary beneath.
           NOTE ON THE SUMMARY: the brief calls for an AI-generated summary
           "clearly marked as AI-generated". The AI Gateway capability does
           not exist yet, so what shows here is the matter's own
           human-written description, deliberately NOT badged as AI. Putting
           an "AI-generated" label on text a person wrote would be a false
           attribution, and attribution is the entire point of that spec's
           invariant. The badge goes on when a real AIInsight backs it. */
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
                  {health && <span className={`badge ${health.cls} text-xs flex-shrink-0`}>{health.label}</span>}
                </div>

                <div className="matter-card-pills">
                  <span className="badge text-xs">{MATTER_TYPES.find(m => m.value === matter.type)?.label || matter.type}</span>
                  <span className={`badge ${getStatusColor(matter.status)} text-xs`}>
                    {STAGES.find(s => s.key === matter.status)?.label || matter.status}
                  </span>
                  {matter.litigation_status && (
                    <span className="badge text-xs">{litigationStatusLabel(matter.litigation_status)}</span>
                  )}
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
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                {['Matter No.', 'Title / Client', 'Type', 'Status', 'Health', 'Attorney', 'Last Activity', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {matters.map(matter => (
                <tr key={matter.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-[var(--color-accent)] font-bold">{matter.matter_number}</span>
                      {matter.is_confidential && <span title="Confidential"><Lock className="w-3 h-3 text-[var(--color-muted)]" /></span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)] line-clamp-1 max-w-48">{matter.title}</div>
                    <div className="text-xs text-[var(--color-muted)]">{matter.client_name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {MATTER_TYPES.find(m => m.value === matter.type)?.label || matter.type}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getStatusColor(matter.status)} text-xs`}>{STAGES.find(s => s.key === matter.status)?.label || matter.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const health = matterHealth(matter)
                      return health ? <span className={`badge ${health.cls} text-xs`}>{health.label}</span> : <span className="text-xs text-[var(--color-muted)]">-</span>
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {matter.assigned_attorney?.full_name || <span className="text-[var(--color-accent)]">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{matter.updated_at ? formatDate(matter.updated_at, 'short') : formatDate(matter.opening_date, 'short')}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/matters/${matter.id}`} className="btn btn-ghost p-1.5 !px-1.5">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <Scale className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">Open New Matter</h2>
            </div>
            <div className="flex flex-col gap-4">
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
              <div className="flex gap-3">
                <button onClick={createMatter} className="btn btn-primary flex-1">Open Matter</button>
                <button onClick={() => setShowCreate(false)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
