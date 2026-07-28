'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Plus, ArrowRight, AlertCircle, UserPlus, Eye, Globe, XCircle } from 'lucide-react'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { stageMeta } from '@/lib/matterLifecycle'
import toast from 'react-hot-toast'

interface ActionReason { label: string; tone: 'risk' | 'warn' }

interface Account {
  id: string
  full_name: string
  email: string
  phone?: string
  portal_active: boolean
  created_at: string
  advocates: string[]
  matters: { id: string; matter_number: string; title: string; status: string }[]
  activeMatters: number
  pipelineMatters: number
  outstanding: number
  reasons: ActionReason[]
  lastActivity: string
}

interface PreAccount {
  id: string
  tracking_code: string
  type: string
  status: string
  submitter_name: string
  submitter_email: string
  submitter_phone?: string
  created_at: string
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'action', label: 'Needs action' },
  { key: 'pipeline', label: 'In pipeline' },
  { key: 'active', label: 'Active matters' },
  { key: 'portal', label: 'On portal' },
  { key: 'no_portal', label: 'No portal' },
  { key: 'dormant', label: 'No matters' },
] as const

export default function ClientAccounts() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [preAccounts, setPreAccounts] = useState<PreAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newAccount, setNewAccount] = useState({ full_name: '', email: '', phone: '' })
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  function load() {
    fetch('/api/accounts')
      .then(r => (r.ok ? r.json() : { accounts: [], preAccounts: [] }))
      .then(d => {
        setAccounts(d.accounts || [])
        setPreAccounts(d.preAccounts || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function addAccount(payload: { full_name: string; email: string; phone?: string }, fromPreAccountId?: string) {
    if (!payload.full_name || !payload.email) { toast.error('Name and email are required'); return }
    if (fromPreAccountId) setCreatingFrom(fromPreAccountId)
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, role: 'client' }),
      })
      if (res.ok) {
        const created = await res.json()
        toast.success('Client account created')
        setShowAdd(false)
        setNewAccount({ full_name: '', email: '', phone: '' })
        load()
        if (!fromPreAccountId) router.push(`/admin/people/${created.id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not create the account')
      }
    } finally {
      setCreatingFrom(null)
    }
  }

  // Close a pre-account: the enquiry ended without a prospect (e.g. after a
  // consultation there is nothing to act on). This ends the journey quietly,   // no client email is sent, because we pass a status change with no message.
  async function closePreAccount(id: string, name: string) {
    if (!confirm(`Close the enquiry from ${name}? Their journey ends here, no account is created and they are removed from this list. This can be reopened from Submissions if needed.`)) return
    setClosingId(id)
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (res.ok) { toast.success('Enquiry closed'); load() }
      else toast.error('Could not close the enquiry')
    } finally {
      setClosingId(null)
    }
  }

  const needsAction = accounts.filter(a => a.reasons.length > 0)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter(a => {
      if (q && !a.full_name.toLowerCase().includes(q) && !a.email.toLowerCase().includes(q)) return false
      switch (filter) {
        case 'action': return a.reasons.length > 0
        case 'pipeline': return a.pipelineMatters > 0
        case 'active': return a.activeMatters > 0
        case 'portal': return a.portal_active
        case 'no_portal': return !a.portal_active
        case 'dormant': return a.matters.length === 0
        default: return true
      }
    })
  }, [accounts, search, filter])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Client Directory</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1 max-w-xl">
            Every relationship the firm holds, enquiries not yet taken on, and the client accounts that carry all their matters, appointments, documents and billing.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Register shape */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Pre-accounts', value: preAccounts.length, alert: preAccounts.length > 0 },
          { label: 'Client accounts', value: accounts.length },
          { label: 'Need intervention', value: needsAction.length, alert: needsAction.length > 0 },
          { label: 'On the portal', value: accounts.filter(a => a.portal_active).length },
        ].map(s => (
          <div key={s.label} className="card px-4 py-2.5">
            <div className={`text-lg font-display font-semibold ${s.alert ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{s.value}</div>
            <div className="text-xs text-[var(--color-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pre-accounts FIRST, the top of the journey. A website enquiry from
          someone with no account yet: decide to take them on (create the
          account) or end it here (close). */}
      {preAccounts.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[var(--color-accent)]" /> Pre-accounts
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Enquiries from people who reached out but are not yet clients. Review the request, then either create an account if the firm is retained, or close it if the journey ends here, for example, a consultation that leads to no instruction.
          </p>
          <div className="flex flex-col gap-1.5">
            {preAccounts.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{p.submitter_name}</span>
                    <span className="badge status-pending text-xs capitalize">{p.type}</span>
                    <span className={`badge ${getStatusColor(p.status)} text-xs`}>{p.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">{p.submitter_email} · {formatDate(p.created_at, 'short')}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/admin/submissions/${p.id}`} className="btn btn-outline text-xs gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Review Request
                  </Link>
                  <button
                    onClick={() => addAccount({ full_name: p.submitter_name, email: p.submitter_email, phone: p.submitter_phone }, p.id)}
                    disabled={creatingFrom === p.id}
                    className="btn btn-primary text-xs gap-1.5"
                  >
                    {creatingFrom === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    Create Account
                  </button>
                  <button
                    onClick={() => closePreAccount(p.id, p.submitter_name)}
                    disabled={closingId === p.id}
                    className="btn btn-ghost text-xs gap-1.5 text-[var(--color-muted)]"
                    title="End this enquiry, no account is created"
                  >
                    {closingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts needing intervention, derived from the data, not tagged */}
      {needsAction.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-accent)]" /> Needs intervention
          </h2>
          <div className="flex flex-col gap-1.5">
            {needsAction.map(a => (
              <Link key={a.id} href={`/admin/people/${a.id}`}
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors group flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{a.full_name}</span>
                  {a.reasons.map((r, i) => (
                    <span key={i} className={`badge text-xs ${r.tone === 'risk' ? 'status-rejected' : 'status-pending'}`}>{r.label}</span>
                  ))}
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Client accounts, search, filter, relationships at a glance */}
      <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-3">Client accounts</h2>
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" className="input pl-9 text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No accounts match.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                {['Account', 'Advocates', 'Matters', 'Outstanding', 'Portal', 'Last Activity', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/people/${a.id}`} className="group">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] group-hover:underline">{a.full_name}</span>
                        {a.reasons.length > 0 && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.reasons.some(r => r.tone === 'risk') ? 'bg-red-500' : 'bg-amber-500'}`}
                            title={a.reasons.map(r => r.label).join(' · ')} />
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">{a.email}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {a.advocates.length > 0 ? a.advocates.join(', ') : <span className="text-[var(--color-muted)]">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.matters.length === 0 ? (
                      <span className="text-xs text-[var(--color-muted)]">None</span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {a.matters.slice(0, 2).map(m => (
                          <Link key={m.id} href={`/admin/matters/${m.id}`}
                            className={`badge ${getStatusColor(m.status)} text-xs hover:opacity-80`}
                            title={m.title}>
                            {stageMeta(m.status).label}
                          </Link>
                        ))}
                        {a.matters.length > 2 && <span className="text-xs text-[var(--color-muted)]">+{a.matters.length - 2}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-primary)]">
                    {a.outstanding > 0 ? formatCurrency(a.outstanding) : <span className="text-[var(--color-muted)] font-normal">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${a.portal_active ? 'status-active' : 'status-pending'}`}>
                      {a.portal_active ? 'Active' : 'Not invited'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{formatDate(a.lastActivity, 'short')}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/people/${a.id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Open account">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add account */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-md shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)] mb-1">Add Client Account</h2>
            <p className="text-xs text-[var(--color-text-muted)] mb-5">Creates the account record. Portal access is a separate, later step, invite them from their account page when ready.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input text-sm" value={newAccount.full_name} onChange={e => setNewAccount(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input text-sm" value={newAccount.email} onChange={e => setNewAccount(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input text-sm" value={newAccount.phone} onChange={e => setNewAccount(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => addAccount(newAccount)} className="btn btn-primary flex-1">Create Account</button>
                <button onClick={() => setShowAdd(false)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
