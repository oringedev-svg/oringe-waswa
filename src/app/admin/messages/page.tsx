'use client'
import { useEffect, useMemo, useState } from 'react'
import { Send, Loader2, Megaphone, Mail, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { TeamMember } from '@/types'

interface TeamMessage {
  id: string
  sender_id: string
  recipient_id?: string
  is_broadcast: boolean
  subject?: string
  content: string
  is_read: boolean
  created_at: string
  sender?: { full_name: string; avatar_url?: string; position: string }
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [me, setMe] = useState<{ email?: string; fullName?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'inbox' | 'broadcasts'>('inbox')

  const [form, setForm] = useState({ recipient_id: '', is_broadcast: false, subject: '', content: '' })

  const myMember = useMemo(
    () => team.find((t) => t.email?.toLowerCase() === me?.email?.toLowerCase()),
    [team, me]
  )

  function load() {
    setLoading(true)
    fetch('/api/team/messages')
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/team').then((r) => r.json()).then((d) => setTeam(Array.isArray(d) ? d : []))
    fetch('/api/me').then((r) => (r.ok ? r.json() : null)).then((d) => d && setMe({ email: d.email, fullName: d.fullName }))
  }, [])

  async function send() {
    if (!form.content.trim()) { toast.error('Message cannot be empty'); return }
    if (!form.is_broadcast && !form.recipient_id) { toast.error('Choose a recipient, or send as a broadcast'); return }
    if (!myMember) { toast.error('Could not identify your team profile, ask an admin to link your account to a Team entry'); return }
    setSending(true)
    try {
      const res = await fetch('/api/team/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: myMember.id,
          recipient_id: form.is_broadcast ? null : form.recipient_id,
          is_broadcast: form.is_broadcast,
          subject: form.subject || null,
          content: form.content,
        }),
      })
      if (res.ok) {
        toast.success('Message sent')
        setForm({ recipient_id: '', is_broadcast: false, subject: '', content: '' })
        load()
      } else {
        toast.error('Send failed')
      }
    } finally {
      setSending(false)
    }
  }

  const filtered = messages.filter((m) => (tab === 'broadcasts' ? m.is_broadcast : !m.is_broadcast))

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="mb-6">
          <p className="eyebrow mb-2">Communications</p>
          <h1 className="font-display font-semibold" style={{ fontSize: 'var(--heading-page-size)' }}>Team Messages</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Internal messaging between team members, separate from client-facing email.</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('inbox')} className={`btn ${tab === 'inbox' ? 'btn-primary' : 'btn-ghost'}`}>
            <Inbox className="w-4 h-4" /> Direct
          </button>
          <button onClick={() => setTab('broadcasts')} className={`btn ${tab === 'broadcasts' ? 'btn-primary' : 'btn-ghost'}`}>
            <Megaphone className="w-4 h-4" /> Broadcasts
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Mail className="w-8 h-8 mx-auto mb-3 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No {tab === 'broadcasts' ? 'broadcasts' : 'direct messages'} yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[var(--color-text-primary)]">{m.sender?.full_name || 'Team member'}</span>
                    {m.sender?.position && <span className="text-xs text-[var(--color-text-muted)]">{m.sender.position}</span>}
                    {m.is_broadcast && <span className="badge text-[var(--color-accent)]">Broadcast</span>}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.subject && <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{m.subject}</p>}
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 h-fit sticky top-6">
        <h3 className="font-display font-semibold text-base mb-4">New message</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={form.is_broadcast} onChange={(e) => setForm({ ...form, is_broadcast: e.target.checked })} />
            Send as a firm-wide broadcast
          </label>
          {!form.is_broadcast && (
            <div>
              <label className="label">Recipient</label>
              <select className="input" value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}>
                <option value="">Select team member…</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.full_name}, {t.position}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Subject (optional)</label>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input" rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <button className="btn btn-primary w-full" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
          </button>
        </div>
      </div>
    </div>
  )
}
