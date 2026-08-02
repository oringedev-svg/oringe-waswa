'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Edit, Trash2, MessageSquare, Loader2, Send, X, UserPlus, ExternalLink, Archive, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import { formatDate } from '@/lib/utils'

interface TeamMember {
  id: string
  full_name: string
  email: string
  phone?: string
  position: string
  department: string
  specializations: string[]
  bio?: string
  avatar_url?: string
  bar_number?: string
  years_experience?: number
  display_order: number
  is_visible: boolean
  is_active: boolean
  seniority: string
  profile?: { user_id: string | null } | null
}

const SENIORITIES = [
  { value: 'partner', label: 'Partner' },
  { value: 'senior_associate', label: 'Senior Associate' },
  { value: 'associate', label: 'Associate' },
  { value: 'pupil', label: 'Pupil' },
  { value: 'admin_assistant', label: 'Administrative Assistant' },
  { value: 'other', label: 'Other' },
]

interface TeamMessage {
  id: string
  sender: { full_name: string; avatar_url?: string }
  subject?: string
  content: string
  is_broadcast: boolean
  created_at: string
}

const DEPARTMENTS = ['Legal', 'Corporate', 'Litigation', 'Family Law', 'Property', 'Immigration', 'Employment', 'Administration', 'IT', 'Finance']

export default function AdminTeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'members' | 'messages'>('members')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<Partial<TeamMember> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [msgForm, setMsgForm] = useState({ subject: '', content: '', recipient_id: '', is_broadcast: false })
  const [senderId, setSenderId] = useState('')
  const [saving, setSaving] = useState(false)
  const [revisions, setRevisions] = useState<{ id: string; data: { full_name?: string; position?: string; bio?: string }; note: string | null; created_at: string; author?: { full_name: string } | null }[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [creatingAccountFor, setCreatingAccountFor] = useState<string | null>(null)
  // Department options are firm-configurable via org_categories (migration
  // 020) once it's run; falls back to the original hardcoded list so this
  // page keeps working unchanged on an older schema.
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(DEPARTMENTS)

  async function createAccount(member: TeamMember) {
    setCreatingAccountFor(member.id)
    try {
      const res = await fetch(`/api/team/${member.id}/create-account`, { method: 'POST' })
      if (res.ok) { toast.success(`Invitation sent to ${member.full_name}`); load() }
      else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not create the account')
      }
    } finally {
      setCreatingAccountFor(null)
    }
  }

  async function load() {
    setLoading(true)
    const [teamData, msgData] = await Promise.all([
      fetch('/api/team').then(r => r.json()),
      fetch('/api/team/messages').then(r => r.json()),
    ])
    setTeam(teamData || [])
    setMessages(msgData || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/organization/categories').then(r => r.json()).then(d => {
      if (Array.isArray(d) && d.length > 0) setDepartmentOptions(d.map((c: { name: string }) => c.name))
    }).catch(() => {})
  }, [])

  async function saveMember() {
    if (!editing?.full_name || !editing?.email || !editing?.position) {
      toast.error('Name, email, and position required')
      return
    }
    setSaving(true)
    try {
      // Strip `profile` — it's a joined/computed field from GET /api/team
      // (profile:profiles(user_id)), not a real column on team_members.
      // Sending it through to Supabase's .update() causes a silent 500.
      const { profile: _profile, revisions: _revisions, ...rest } = editing as Partial<TeamMember> & { revisions?: unknown }

      const payload = {
        ...rest,
        specializations: typeof rest.specializations === 'string'
          ? (rest.specializations as unknown as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : rest.specializations || [],
      }
      const res = isNew
        ? await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/team/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast.success(isNew ? 'Member added!' : 'Member updated!'); setEditing(null); load() }
      else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Save failed')
      }
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  async function deleteMember(id: string) {
    if (!confirm('Deactivate this team member? They can be restored later from the Inactive view.')) return
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Member deactivated'); load() }
    else toast.error('Failed')
  }

  async function restoreMember(id: string) {
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }),
    })
    if (res.ok) { toast.success('Member restored'); load() }
    else toast.error('Failed')
  }

  async function restoreRevision(revisionId: string) {
    if (!editing?.id) return
    if (!confirm('Restore this version? The current details will be saved as a new revision first.')) return
    setRestoring(revisionId)
    try {
      const res = await fetch(`/api/team/${editing.id}/revisions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: revisionId }),
      })
      if (res.ok) {
        toast.success('Version restored')
        const data = await fetch(`/api/team/${editing.id}`).then(r => r.json())
        setEditing(data)
        setRevisions(data.revisions || [])
        load()
      } else {
        toast.error('Could not restore version')
      }
    } finally {
      setRestoring(null)
    }
  }

  async function sendMessage() {
    if (!msgForm.content || !senderId) { toast.error('Select sender and write a message'); return }
    const res = await fetch('/api/team/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: senderId,
        recipient_id: msgForm.is_broadcast ? null : msgForm.recipient_id || null,
        is_broadcast: msgForm.is_broadcast,
        subject: msgForm.subject,
        content: msgForm.content,
      }),
    })
    if (res.ok) {
      toast.success('Message sent!')
      setMsgForm({ subject: '', content: '', recipient_id: '', is_broadcast: false })
      load()
    } else toast.error('Send failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Team</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {team.filter(m => showInactive ? !m.is_active : m.is_active).length} {showInactive ? 'inactive' : 'active'} members
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInactive(!showInactive)} className={`btn gap-2 text-sm ${showInactive ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {showInactive ? 'Viewing Inactive' : 'Inactive'}
          </button>
          {!showInactive && (
            <button onClick={() => { setEditing({ department: 'Legal', seniority: 'associate', display_order: 0, is_visible: true, specializations: [] }); setIsNew(true); setRevisions([]) }}
              className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Member
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--color-border)] mb-6">
        {(['members', 'messages'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : tab === 'members' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.filter(m => showInactive ? !m.is_active : m.is_active).length === 0 && (
            <div className="card p-12 text-center text-[var(--color-muted)] md:col-span-2 lg:col-span-3">
              {showInactive ? 'No inactive members.' : 'No active members found.'}
            </div>
          )}
          {team.filter(m => showInactive ? !m.is_active : m.is_active).map(member => (
            <div key={member.id} className="card p-5 flex gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {member.avatar_url
                  ? <Image src={member.avatar_url} alt={member.full_name} width={56} height={56} className="object-cover" />
                  : <span className="font-display text-xl text-[var(--color-accent)]">{member.full_name.charAt(0)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{member.full_name}</h3>
                    <p className="text-xs text-[var(--color-accent)]">{member.position}</p>
                    <p className="text-xs text-[var(--color-muted)]">{member.department}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {showInactive ? (
                      <button onClick={() => restoreMember(member.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]" title="Restore">
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <Link href={`/admin/team/${member.id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Full profile">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => {
                          setEditing({ ...member, specializations: member.specializations })
                          setIsNew(false)
                          setRevisions([])
                          fetch(`/api/team/${member.id}`).then(r => r.json()).then(d => setRevisions(d.revisions || []))
                        }}
                          className="btn btn-ghost p-1.5 !px-1.5">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMember(member.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2 items-center">
                  <span className="badge status-review text-xs capitalize">{SENIORITIES.find(s => s.value === member.seniority)?.label || member.seniority}</span>
                  {member.specializations?.slice(0, 2).map(s => (
                    <span key={s} className="text-xs px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-muted)]">{s}</span>
                  ))}
                  {!member.is_visible && <span className="badge status-pending text-xs">Hidden</span>}
                </div>
                {member.profile?.user_id ? (
                  <span className="text-xs text-[var(--color-muted)] mt-2 inline-block">Has account access</span>
                ) : (
                  <button
                    onClick={() => createAccount(member)}
                    disabled={creatingAccountFor === member.id}
                    className="btn btn-outline text-xs gap-1.5 mt-2"
                  >
                    {creatingAccountFor === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    Create Login
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Compose */}
          <div className="lg:col-span-2 card p-5 h-fit">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" /> Send Message
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">From (Your Name)</label>
                <select className="input text-sm" value={senderId} onChange={e => setSenderId(e.target.value)}>
                  <option value="">Select sender…</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={msgForm.is_broadcast} onChange={e => setMsgForm(f => ({ ...f, is_broadcast: e.target.checked }))}
                  className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Broadcast to all team</span>
              </label>
              {!msgForm.is_broadcast && (
                <div>
                  <label className="label">To</label>
                  <select className="input text-sm" value={msgForm.recipient_id} onChange={e => setMsgForm(f => ({ ...f, recipient_id: e.target.value }))}>
                    <option value="">Select recipient…</option>
                    {team.filter(m => m.id !== senderId).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Subject</label>
                <input className="input text-sm" value={msgForm.subject} onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))} placeholder="Optional subject" />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea rows={4} className="input text-sm" value={msgForm.content} onChange={e => setMsgForm(f => ({ ...f, content: e.target.value }))} />
              </div>
              <button onClick={sendMessage} className="btn btn-primary gap-2 text-sm">
                <Send className="w-4 h-4" /> Send Message
              </button>
            </div>
          </div>

          {/* Message list */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Recent Messages</h3>
            {messages.length === 0 ? (
              <div className="card p-8 text-center text-[var(--color-muted)]">No messages yet.</div>
            ) : messages.map(msg => (
              <div key={msg.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-sm text-[var(--color-accent)]">{msg.sender?.full_name?.charAt(0) || '?'}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{msg.sender?.full_name}</span>
                      {msg.is_broadcast && <span className="badge status-pending text-xs">Broadcast</span>}
                      <span className="text-xs text-[var(--color-muted)] ml-auto">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    {msg.subject && <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">{msg.subject}</p>}
                    <p className="text-sm text-[var(--color-text-secondary)]">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-2xl shadow-[var(--shadow-xl)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">
                {isNew ? 'Add Team Member' : 'Edit Team Member'}
              </h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input text-sm" value={editing.full_name || ''} onChange={e => setEditing(f => ({ ...f!, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input text-sm" value={editing.email || ''} onChange={e => setEditing(f => ({ ...f!, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input text-sm" value={editing.phone || ''} onChange={e => setEditing(f => ({ ...f!, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Position *</label>
                <input className="input text-sm" value={editing.position || ''} onChange={e => setEditing(f => ({ ...f!, position: e.target.value }))} placeholder="e.g. Senior Partner" />
              </div>
              <div>
                <label className="label">Department</label>
                <select className="input text-sm" value={editing.department || 'Legal'} onChange={e => setEditing(f => ({ ...f!, department: e.target.value }))}>
                  {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Seniority</label>
                <select className="input text-sm" value={editing.seniority || 'associate'} onChange={e => setEditing(f => ({ ...f!, seniority: e.target.value }))}>
                  {SENIORITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Years Experience</label>
                <input type="number" className="input text-sm" value={editing.years_experience || ''} onChange={e => setEditing(f => ({ ...f!, years_experience: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Bar Number</label>
                <input className="input text-sm" value={editing.bar_number || ''} onChange={e => setEditing(f => ({ ...f!, bar_number: e.target.value }))} />
              </div>
              <div>
                <label className="label">Display Order</label>
                <input type="number" className="input text-sm" value={editing.display_order || 0} onChange={e => setEditing(f => ({ ...f!, display_order: parseInt(e.target.value) }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Specializations (comma-separated)</label>
                <input className="input text-sm" value={Array.isArray(editing.specializations) ? editing.specializations.join(', ') : (editing.specializations as unknown as string) || ''}
                  onChange={e => setEditing(f => ({ ...f!, specializations: e.target.value as unknown as string[] }))} placeholder="Civil Litigation, Criminal Defense" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Bio</label>
                <textarea rows={4} className="input text-sm" value={editing.bio || ''} onChange={e => setEditing(f => ({ ...f!, bio: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <ImagePicker
                  value={editing.avatar_url || ''}
                  onChange={(url) => setEditing(f => ({ ...f!, avatar_url: url }))}
                  label="Profile Photo"
                />
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editing.is_visible !== false} onChange={e => setEditing(f => ({ ...f!, is_visible: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
                  <span className="text-sm">Visible on website</span>
                </label>
              </div>
            </div>

            {!isNew && revisions.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Revisions</h3>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="text-xs flex items-center justify-between gap-2">
                      <span className="text-[var(--color-muted)]">
                        {formatDate(rev.created_at, 'short')}
                        {rev.author?.full_name ? ` · ${rev.author.full_name}` : ''}
                      </span>
                      <button onClick={() => restoreRevision(rev.id)} disabled={restoring === rev.id} className="text-[var(--color-accent)] hover:underline flex-shrink-0">
                        {restoring === rev.id ? 'Restoring…' : 'Restore'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={saveMember} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Member' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}