'use client'
import { useEffect, useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [catalog, setCatalog] = useState<PermissionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/permissions').then((r) => r.json()),
    ])
      .then(([u, p]) => {
        setUsers(u || [])
        setCatalog(p || [])
      })
      .finally(() => setLoading(false))
  }, [])

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
      toast.error('Could not update role')
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

  const categories = Array.from(new Set(catalog.map((p) => p.category)))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Users</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Roles set a baseline. Individual permissions add capability on top, nothing here removes what a role already grants.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {users.map((user) => {
            const isAdmin = user.role === 'admin'
            const defaults = ROLE_DEFAULTS[user.role] || []
            return (
              <div key={user.id} className="border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user.full_name}</div>
                    <div className="text-xs text-[var(--color-muted)] truncate">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <select
                      className="input text-sm !w-auto"
                      value={user.role}
                      disabled={busy === user.id}
                      onChange={(e) => changeRole(user, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {expanded === user.id ? 'Hide' : 'Permissions'}
                    </button>
                  </div>
                </div>

                {expanded === user.id && (
                  <div className="px-4 pb-4 bg-[var(--color-surface-raised)]">
                    {isAdmin ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] py-2">
                        <Shield className="w-4 h-4 text-[var(--color-accent)]" />
                        Administrator, has every permission.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3">
                        {categories.map((cat) => (
                          <div key={cat}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">{cat}</div>
                            <div className="flex flex-col gap-1.5">
                              {catalog.filter((p) => p.category === cat).map((perm) => {
                                const fromRole = defaults.includes(perm.key)
                                const granted = fromRole || user.grants.includes(perm.key)
                                return (
                                  <label key={perm.key} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={granted}
                                      disabled={fromRole || busy === user.id + perm.key}
                                      onChange={() => toggleGrant(user, perm.key, user.grants.includes(perm.key))}
                                    />
                                    <span className={fromRole ? 'text-[var(--color-muted)]' : 'text-[var(--color-text-secondary)]'}>
                                      {perm.label}
                                      {fromRole && <span className="ml-1 text-xs">(from role)</span>}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {users.length === 0 && (
            <p className="text-sm text-[var(--color-muted)] px-4 py-8 text-center">No users yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
