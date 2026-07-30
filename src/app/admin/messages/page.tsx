'use client'
import { useEffect, useMemo, useState } from 'react'
import { Send, Megaphone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { TeamMember } from '@/types'
import { PageHeader, StatusPill, EmptyState, LoadingState, FilterTabs } from '@/components/admin/ui'

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
    if (!myMember) { toast.error('Could not identify your team profile. Ask an admin to link your account to a Team entry'); return }
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
  const broadcastCount = messages.filter(m => m.is_broadcast).length

  return (
    <div>
      <PageHeader
        icon={Mail}
        eyebrow="Communications"
        title="Team Messages"
        description="Internal messaging between team members, separate from client-facing email."
        meta={[`${filtered.length} ${tab === 'broadcasts' ? 'broadcasts' : 'direct'}`]}
      >
        <FilterTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'inbox', label: 'Direct', count: messages.length - broadcastCount },
            { value: 'broadcasts', label: 'Broadcasts', count: broadcastCount },
          ]}
        />
      </PageHeader>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={tab === 'broadcasts' ? Megaphone : Mail}
              title={`No ${tab === 'broadcasts' ? 'broadcasts' : 'direct messages'} yet`}
              description="Use the composer to send the first one."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((m) => (
                <article key={m.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-[var(--color-text-primary)]">{m.sender?.full_name || 'Team member'}</span>
                      {m.sender?.position && <span className="text-xs text-[var(--color-text-muted)]">{m.sender.position}</span>}
                      {m.is_broadcast && <StatusPill tone="review">Broadcast</StatusPill>}
                    </div>
                    <time className="text-xs text-[var(--color-text-muted)] flex-shrink-0" dateTime={m.created_at}>
                      {new Date(m.created_at).toLocaleString()}
                    </time>
                  </div>
                  {m.subject && <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{m.subject}</p>}
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 h-fit lg:sticky lg:top-20">
          <h2 className="font-display font-semibold text-base mb-4">New message</h2>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--color-accent)]"
                checked={form.is_broadcast}
                onChange={(e) => setForm({ ...form, is_broadcast: e.target.checked })}
              />
              Send as a firm-wide broadcast
            </label>
            {!form.is_broadcast && (
              <div>
                <label className="label">Recipient</label>
                <select className="input text-sm" value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}>
                  <option value="">Select team member…</option>
                  {team.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.position}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Subject (optional)</label>
              <input className="input text-sm" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input text-sm" rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <button className="btn btn-primary w-full gap-2" onClick={send} disabled={sending}>
              <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
