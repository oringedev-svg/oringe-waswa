'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Shield, ShieldCheck, Plus, Trash2, ChevronDown, X, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, StatusPill, EmptyState, LoadingState } from '@/components/admin/ui'
import ScopePicker from '@/components/admin/ScopePicker'

interface PermissionRecord {
  key: string
  label: string
  category: string
  description: string | null
}

interface RolePermission {
  id: string
  permission_key: string
  scope_type: string
  scope_id: string | null
}

interface Role {
  id: string
  name: string
  description: string | null
  is_system: boolean
  member_count: number
  role_permissions: RolePermission[]
}

interface Member {
  membership_id: string
  profile_id: string
  full_name: string
  email: string
  assigned_at: string
}

interface UserOption {
  id: string
  full_name: string
  email: string
}

function scopeLabel(scopeType: string, scopeId: string | null) {
  if (scopeType === 'firm') return 'Firm-wide'
  return `${scopeType}${scopeId ? '' : ' (unscoped)'}`
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [catalog, setCatalog] = useState<PermissionRecord[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [membersByRole, setMembersByRole] = useState<Record<string, Member[]>>({})
  const [creating, setCreating] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [newPermRoleId, setNewPermRoleId] = useState<string | null>(null)
  const [newPermKey, setNewPermKey] = useState('')
  const [newPermScopeType, setNewPermScopeType] = useState('firm')
  const [newPermScopeId, setNewPermScopeId] = useState<string | null>(null)

  const [newMemberRoleId, setNewMemberRoleId] = useState<string | null>(null)
  const [newMemberProfileId, setNewMemberProfileId] = useState('')

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/roles').then((r) => r.json()),
      fetch('/api/permissions').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ])
      .then(([r, p, u]) => {
        setRoles(r.roles || [])
        setCatalog(p || [])
        setUsers((u.users || []).map((x: { id: string; full_name: string; email: string }) => ({ id: x.id, full_name: x.full_name, email: x.email })))
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function loadMembers(roleId: string) {
    fetch(`/api/roles/${roleId}/members`)
      .then((r) => r.json())
      .then((d) => setMembersByRole((prev) => ({ ...prev, [roleId]: d.members || [] })))
  }

  function toggleExpand(roleId: string) {
    const next = expanded === roleId ? null : roleId
    setExpanded(next)
    if (next && !membersByRole[next]) loadMembers(next)
  }

  async function createRole() {
    if (!newRoleName.trim()) return
    setSaving(true)
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDescription.trim() || undefined }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Role created')
      setCreating(false)
      setNewRoleName('')
      setNewRoleDescription('')
      load()
    } else {
      toast.error((await res.json()).error || 'Could not create role')
    }
  }

  async function deleteRole(role: Role) {
    if (!confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return
    const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Role deleted')
      load()
    } else {
      toast.error((await res.json()).error || 'Could not delete role')
    }
  }

  async function addPermission(roleId: string) {
    if (!newPermKey) { toast.error('Choose a permission'); return }
    if (newPermScopeType !== 'firm' && !newPermScopeId) { toast.error('Choose what this scope applies to'); return }
    setSaving(true)
    const res = await fetch(`/api/roles/${roleId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_key: newPermKey, scope_type: newPermScopeType, scope_id: newPermScopeId }),
    })
    setSaving(false)
    if (res.ok) {
      setNewPermRoleId(null)
      setNewPermKey('')
      setNewPermScopeType('firm')
      setNewPermScopeId(null)
      load()
    } else {
      toast.error((await res.json()).error || 'Could not add permission')
    }
  }

  async function removePermission(roleId: string, grantId: string) {
    const res = await fetch(`/api/roles/${roleId}/permissions?grant_id=${grantId}`, { method: 'DELETE' })
    if (res.ok) load()
    else toast.error('Could not remove permission')
  }

  async function addMember(roleId: string) {
    if (!newMemberProfileId) { toast.error('Choose a person'); return }
    setSaving(true)
    const res = await fetch(`/api/roles/${roleId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: newMemberProfileId }),
    })
    setSaving(false)
    if (res.ok) {
      setNewMemberRoleId(null)
      setNewMemberProfileId('')
      loadMembers(roleId)
      load()
    } else {
      toast.error((await res.json()).error || 'Could not assign role')
    }
  }

  async function removeMember(roleId: string, membershipId: string) {
    const res = await fetch(`/api/roles/${roleId}/members?membership_id=${membershipId}`, { method: 'DELETE' })
    if (res.ok) {
      loadMembers(roleId)
      load()
    } else {
      toast.error('Could not remove')
    }
  }

  const permLabel = (key: string) => catalog.find((p) => p.key === key)?.label || key

  return (
    <div>
      <PageHeader
        icon={Shield}
        eyebrow="Access control"
        title="Roles"
        description="Custom roles carry scoped permissions -- a role limited to one department, team, or matter, on top of everyone's base role. System roles (shown locked) are the firm's five built-in roles; their permissions can still be extended here."
        meta={[`${roles.length} roles`]}
      >
        <Link href="/admin/users" className="btn btn-ghost gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to people
        </Link>
        <button className="btn btn-primary gap-2 text-sm" onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> New role
        </button>
      </PageHeader>

      {creating && (
        <div className="card p-4 mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="Role name, e.g. Conveyancing Lead" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
          <input className="input" placeholder="Description (optional)" value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={saving || !newRoleName.trim()} onClick={createRole}>
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : roles.length === 0 ? (
        <EmptyState icon={Shield} title="No roles yet" />
      ) : (
        <div className="card overflow-hidden">
          {roles.map((role) => {
            const isOpen = expanded === role.id
            const members = membersByRole[role.id] || []
            return (
              <div key={role.id} className="border-b border-[var(--color-border)] last:border-0">
                <button
                  onClick={() => toggleExpand(role.id)}
                  className="w-full flex items-center justify-between px-4 py-3 gap-4 hover:bg-[var(--color-surface-overlay)] transition-colors text-left"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    {role.is_system ? (
                      <ShieldCheck className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                    ) : (
                      <Shield className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{role.name}</div>
                      {role.description && <div className="text-xs text-[var(--color-text-muted)] truncate">{role.description}</div>}
                    </div>
                    {role.is_system && <StatusPill tone="neutral">System</StatusPill>}
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {role.role_permissions.length} permission{role.role_permissions.length === 1 ? '' : 's'} · {role.member_count} {role.member_count === 1 ? 'person' : 'people'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 bg-[var(--color-surface-overlay)] grid md:grid-cols-2 gap-6">
                    {/* Permissions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Permissions</h3>
                        {!role.is_system || true ? (
                          <button className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setNewPermRoleId(newPermRoleId === role.id ? null : role.id)}>
                            + Add
                          </button>
                        ) : null}
                      </div>

                      {newPermRoleId === role.id && (
                        <div className="card p-3 mb-3 space-y-2">
                          <select className="input text-sm" value={newPermKey} onChange={(e) => setNewPermKey(e.target.value)}>
                            <option value="">Choose permission…</option>
                            {catalog.map((p) => (
                              <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                          </select>
                          <ScopePicker
                            scopeType={newPermScopeType}
                            scopeId={newPermScopeId}
                            onScopeTypeChange={setNewPermScopeType}
                            onScopeIdChange={setNewPermScopeId}
                          />
                          <div className="flex gap-2">
                            <button className="btn btn-primary text-xs flex-1" disabled={saving} onClick={() => addPermission(role.id)}>Add</button>
                            <button className="btn btn-ghost text-xs" onClick={() => setNewPermRoleId(null)}><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}

                      {role.role_permissions.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)]">No permissions granted to this role yet.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {role.role_permissions.map((rp) => (
                            <div key={rp.id} className="flex items-center justify-between gap-2 text-sm bg-[var(--color-surface)] rounded-md px-2.5 py-1.5 border border-[var(--color-border)]">
                              <div className="min-w-0">
                                <div className="truncate">{permLabel(rp.permission_key)}</div>
                                <div className="text-[0.65rem] text-[var(--color-text-muted)]">{scopeLabel(rp.scope_type, rp.scope_id)}</div>
                              </div>
                              <button onClick={() => removePermission(role.id, rp.id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-500 flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Members */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">People</h3>
                        <button className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1" onClick={() => setNewMemberRoleId(newMemberRoleId === role.id ? null : role.id)}>
                          <UserPlus className="w-3.5 h-3.5" /> Assign
                        </button>
                      </div>

                      {newMemberRoleId === role.id && (
                        <div className="card p-3 mb-3 space-y-2">
                          <select className="input text-sm" value={newMemberProfileId} onChange={(e) => setNewMemberProfileId(e.target.value)}>
                            <option value="">Choose person…</option>
                            {users
                              .filter((u) => !members.some((m) => m.profile_id === u.id))
                              .map((u) => (
                                <option key={u.id} value={u.id}>{u.full_name} · {u.email}</option>
                              ))}
                          </select>
                          <div className="flex gap-2">
                            <button className="btn btn-primary text-xs flex-1" disabled={saving} onClick={() => addMember(role.id)}>Assign</button>
                            <button className="btn btn-ghost text-xs" onClick={() => setNewMemberRoleId(null)}><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}

                      {members.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-muted)]">Nobody holds this role yet.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {members.map((m) => (
                            <div key={m.membership_id} className="flex items-center justify-between gap-2 text-sm bg-[var(--color-surface)] rounded-md px-2.5 py-1.5 border border-[var(--color-border)]">
                              <div className="min-w-0">
                                <div className="truncate">{m.full_name}</div>
                                <div className="text-[0.65rem] text-[var(--color-text-muted)] truncate">{m.email}</div>
                              </div>
                              <button onClick={() => removeMember(role.id, m.membership_id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-500 flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {!role.is_system && role.member_count === 0 && (
                      <div className="md:col-span-2 pt-2 border-t border-[var(--color-border)]">
                        <button onClick={() => deleteRole(role)} className="text-xs text-red-600 hover:underline flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Delete this role
                        </button>
                      </div>
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
