'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield, Users, ChevronDown, Plus, X, Clock, Trash2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PageHeader, StatusPill, EmptyState, LoadingState, SearchInput, type Tone,
} from '@/components/admin/ui'
import ScopePicker from '@/components/admin/ScopePicker'
import { formatDate } from '@/lib/utils'

interface PermissionRecord {
  key: string
  label: string
  category: string
  description: string | null
}

interface UserRecord {
  id: string
  user_id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  grants: string[]
}

interface PendingRecord {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

interface ScopedGrant {
  id: string
  permission_key: string
  scope_type: string
  scope_id: string | null
  reason: string
  expires_at: string | null
  created_at: string
}

const ROLES = ['admin', 'staff', 'moderator', 'pupil', 'admin_assistant', 'client', 'public']

const ROLE_DEFAULTS: Record<string, string[]> = {
  staff: ['manage_lawyers', 'manage_media', 'manage_homepage', 'manage_forms', 'publish_articles', 'manage_matters', 'run_conflict_check', 'log_time'],
  moderator: ['approve_articles', 'manage_forms', 'manage_testimonials', 'manage_faqs'],
  // Deliberately empty, everything a pupil or administrative assistant can
  // do comes from an individual grant below, not a role bundle.
  pupil: [],
  admin_assistant: [],
  client: [],
  public: [],
}

// Reach, not seniority. `admin` bypasses every check in the system, so it
// is the one role the list should make impossible to miss.
const ROLE_TONE: Record<string, Tone> = {
  admin: 'overdue',
  staff: 'safe',
  moderator: 'done',
  pupil: 'review',
  admin_assistant: 'review',
  client: 'neutral',
  public: 'neutral',
}

function scopeLabel(scopeType: string, scopeId: string | null) {
  if (scopeType === 'firm') return 'Firm-wide'
  return scopeId ? scopeType : `${scopeType} (unscoped)`
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [pending, setPending] = useState<PendingRecord[]>([])
  const [catalog, setCatalog] = useState<PermissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [scopedGrants, setScopedGrants] = useState<Record<string, ScopedGrant[]>>({})
  const [addingScopedFor, setAddingScopedFor] = useState<string | null>(null)
  const [scopedPermKey, setScopedPermKey] = useState('')
  const [scopedScopeType, setScopedScopeType] = useState('department')
  const [scopedScopeId, setScopedScopeId] = useState<string | null>(null)
  const [scopedReason, setScopedReason] = useState('')

  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'staff' })
  const [savingNewUser, setSavingNewUser] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/permissions').then((r) => r.json()),
    ])
      .then(([u, p]) => {
        setUsers(u.users || [])
        setPending(u.pending || [])
        setCatalog(p || [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function changeRole(user: UserRecord, role: string) {
    setBusy(user.id)
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)))
      toast.success('Role updated')
    } else {
      toast.error((await res.json()).error || 'Could not update role')
    }
    setBusy(null)
  }

  async function toggleGrant(user: UserRecord, key: string, granted: boolean) {
    setBusy(user.id + key)
    const res = await fetch(`/api/users/${user.id}/permissions${granted ? `?permission_key=${key}` : ''}`, {
      method: granted ? 'DELETE' : 'POST',
      headers: granted ? undefined : { 'Content-Type': 'application/json' },
      body: granted ? undefined : JSON.stringify({ permission_key: key }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, grants: granted ? u.grants.filter((g) => g !== key) : [...u.grants, key] }
            : u
        )
      )
    } else {
      toast.error('Could not update permission')
    }
    setBusy(null)
  }

  function loadScopedGrants(userId: string) {
    fetch(`/api/users/${userId}/scoped-grants`)
      .then((r) => r.json())
      .then((d) => setScopedGrants((prev) => ({ ...prev, [userId]: d.grants || [] })))
  }

  function toggleExpand(userId: string) {
    const next = expanded === userId ? null : userId
    setExpanded(next)
    if (next && !scopedGrants[next]) loadScopedGrants(next)
  }

  async function addScopedGrant(userId: string) {
    if (!scopedPermKey) { toast.error('Choose a permission'); return }
    if (scopedScopeType !== 'firm' && !scopedScopeId) { toast.error('Choose what this applies to'); return }
    if (!scopedReason.trim()) { toast.error('A reason is required'); return }
    const res = await fetch(`/api/users/${userId}/scoped-grants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_key: scopedPermKey, scope_type: scopedScopeType, scope_id: scopedScopeId, reason: scopedReason.trim() }),
    })
    if (res.ok) {
      setAddingScopedFor(null)
      setScopedPermKey('')
      setScopedScopeType('department')
      setScopedScopeId(null)
      setScopedReason('')
      loadScopedGrants(userId)
    } else {
      toast.error((await res.json()).error || 'Could not add grant')
    }
  }

  async function removeScopedGrant(userId: string, grantId: string) {
    const res = await fetch(`/api/users/${userId}/scoped-grants/${grantId}`, { method: 'DELETE' })
    if (res.ok) loadScopedGrants(userId)
    else toast.error('Could not remove grant')
  }

  async function createUser() {
    if (!newUser.full_name.trim() || !newUser.email.trim()) { toast.error('Name and email are required'); return }
    setSavingNewUser(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    setSavingNewUser(false)
    if (res.ok) {
      toast.success(`Invite sent to ${newUser.email}`)
      setCreating(false)
      setNewUser({ full_name: '', email: '', role: 'staff' })
      load()
    } else {
      toast.error((await res.json()).error || 'Could not create user')
    }
  }

  const permLabel = (key: string) => catalog.find((p) => p.key === key)?.label || key
  const categories = Array.from(new Set(catalog.map((p) => p.category)))
  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })
  const adminCount = users.filter(u => u.role === 'admin').length

  return (
    <div>
      <PageHeader
        icon={Users}
        eyebrow="Access control"
        title="Users"
        description="Roles set a baseline. Individual permissions add capability on top. Nothing here removes what a role already grants."
        meta={[`${filtered.length} of ${users.length}`, adminCount > 0 ? `${adminCount} administrator${adminCount === 1 ? '' : 's'}` : null]}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
        <select className="input !w-auto text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filter by role">
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
        <Link href="/admin/users/roles" className="btn btn-ghost gap-2 text-sm">
          <ShieldCheck className="w-4 h-4" /> Roles
        </Link>
        <button className="btn btn-primary gap-2 text-sm" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Create user
        </button>
      </PageHeader>

      {creating && (
        <div className="card p-4 mb-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <input className="input" placeholder="Full name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={savingNewUser} onClick={createUser}>
                {savingNewUser ? 'Sending…' : 'Send invite'}
              </button>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}><X className="w-4 h-4" /></button>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            {newUser.role === 'client'
              ? 'Sends a passwordless sign-in link straight to the client portal.'
              : 'Sends an invite email to set a password; they land in the admin panel once accepted.'}
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card p-4 mb-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[var(--color-text-primary)]">
            <Clock className="w-4 h-4 text-amber-500" /> Pending invites ({pending.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm px-2.5 py-1.5 rounded-md bg-[var(--color-surface-overlay)]">
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">{p.full_name}</span>{' '}
                  <span className="text-[var(--color-text-muted)]">{p.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <StatusPill tone={ROLE_TONE[p.role] || 'neutral'}>{p.role.replace(/_/g, ' ')}</StatusPill>
                  invited {formatDate(p.created_at, 'short')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || roleFilter !== 'all' ? 'No users match those filters' : 'No users yet'}
          description={search || roleFilter !== 'all' ? 'Clear the search or pick a different role.' : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((user) => {
            const isAdmin = user.role === 'admin'
            const defaults = ROLE_DEFAULTS[user.role] || []
            const isOpen = expanded === user.id
            const extraGrants = user.grants.filter(g => !defaults.includes(g)).length
            const userScopedGrants = scopedGrants[user.id] || []
            return (
              <div key={user.id} className="border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user.full_name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</div>
                    </div>
                    <StatusPill tone={ROLE_TONE[user.role] || 'neutral'}>{user.role.replace(/_/g, ' ')}</StatusPill>
                    {!isAdmin && extraGrants > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">+{extraGrants} extra</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      className="input text-sm !w-auto"
                      value={user.role}
                      disabled={busy === user.id}
                      onChange={(e) => changeRole(user, e.target.value)}
                      aria-label={`Role for ${user.full_name}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => toggleExpand(user.id)}
                      aria-expanded={isOpen}
                      className="btn btn-ghost !py-1.5 !px-2.5 text-xs gap-1"
                    >
                      Permissions
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 bg-[var(--color-surface-overlay)]">
                    {isAdmin ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] py-3">
                        <Shield className="w-4 h-4 text-[var(--status-danger)]" />
                        Administrator. Has every permission, and bypasses every check.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3">
                          {categories.map((cat) => (
                            <div key={cat}>
                              <div className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-2">{cat}</div>
                              <div className="flex flex-col gap-1.5">
                                {catalog.filter((p) => p.category === cat).map((perm) => {
                                  const fromRole = defaults.includes(perm.key)
                                  const granted = fromRole || user.grants.includes(perm.key)
                                  return (
                                    <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                                        checked={granted}
                                        disabled={fromRole || busy === user.id + perm.key}
                                        onChange={() => toggleGrant(user, perm.key, user.grants.includes(perm.key))}
                                      />
                                      <span className={fromRole ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}>
                                        {perm.label}
                                        {fromRole && <span className="ml-1 text-xs opacity-70">(from role)</span>}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Scoped grants: the narrower counterpart to the firm-wide
                            checkboxes above -- a permission that applies only to
                            one department, team, or matter, with a reason on
                            record. See permission_grants (migration 028). */}
                        <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Scoped permissions
                            </h3>
                            <button
                              className="text-xs text-[var(--color-accent)] hover:underline"
                              onClick={() => setAddingScopedFor(addingScopedFor === user.id ? null : user.id)}
                            >
                              + Add
                            </button>
                          </div>

                          {addingScopedFor === user.id && (
                            <div className="card p-3 mb-3 space-y-2 max-w-md">
                              <select className="input text-sm" value={scopedPermKey} onChange={(e) => setScopedPermKey(e.target.value)}>
                                <option value="">Choose permission…</option>
                                {catalog.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                              </select>
                              <ScopePicker
                                scopeType={scopedScopeType}
                                scopeId={scopedScopeId}
                                onScopeTypeChange={setScopedScopeType}
                                onScopeIdChange={setScopedScopeId}
                              />
                              <input
                                className="input text-sm"
                                placeholder="Reason (required, for the audit trail)"
                                value={scopedReason}
                                onChange={(e) => setScopedReason(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button className="btn btn-primary text-xs flex-1" onClick={() => addScopedGrant(user.id)}>Add</button>
                                <button className="btn btn-ghost text-xs" onClick={() => setAddingScopedFor(null)}><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          )}

                          {userScopedGrants.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-muted)]">No scoped grants.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-w-md">
                              {userScopedGrants.map((g) => (
                                <div key={g.id} className="flex items-center justify-between gap-2 text-sm bg-[var(--color-surface)] rounded-md px-2.5 py-1.5 border border-[var(--color-border)]">
                                  <div className="min-w-0">
                                    <div className="truncate">{permLabel(g.permission_key)} · <span className="text-[var(--color-text-muted)]">{scopeLabel(g.scope_type, g.scope_id)}</span></div>
                                    <div className="text-[0.65rem] text-[var(--color-text-muted)] truncate">{g.reason}</div>
                                  </div>
                                  <button onClick={() => removeScopedGrant(user.id, g.id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-500 flex-shrink-0">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
