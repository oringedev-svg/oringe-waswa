'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Hash, Users, MessageSquare, Plus, X, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { TeamMember } from '@/types'
import { PageHeader, EmptyState, LoadingState } from '@/components/admin/ui'
import { formatDate } from '@/lib/utils'

interface ConversationParticipant {
  profile_id: string
  profile?: { full_name: string; avatar_url?: string }
}

interface Conversation {
  id: string
  type: 'direct' | 'group' | 'channel' | 'matter'
  title?: string
  matter?: { matter_number: string; title: string }
  practice_area?: { title: string }
  participants: ConversationParticipant[]
  last_message?: { content: string; created_at: string } | null
  unread_count: number
  last_message_at?: string
  created_at: string
}

interface Message {
  id: string
  content: string
  message_type: 'message' | 'system'
  reply_to_id: string | null
  created_at: string
  actual_sender: { id: string; full_name: string; avatar_url?: string } | null
  display_sender: { id: string; full_name: string; avatar_url?: string } | null
}

function conversationLabel(c: Conversation, myProfileId: string | null): string {
  if (c.type === 'channel') return c.practice_area?.title || c.title || 'Channel'
  if (c.type === 'matter') return c.matter ? `${c.matter.matter_number} · ${c.matter.title}` : c.title || 'Matter'
  if (c.type === 'group') return c.title || c.participants.map((p) => p.profile?.full_name).filter(Boolean).join(', ')
  // direct: show the other participant's name
  const other = c.participants.find((p) => p.profile_id !== myProfileId)
  return other?.profile?.full_name || 'Direct message'
}

function ConversationIcon({ type }: { type: Conversation['type'] }) {
  if (type === 'channel') return <Hash className="w-4 h-4" />
  if (type === 'matter') return <MessageSquare className="w-4 h-4" />
  if (type === 'group') return <Users className="w-4 h-4" />
  return <MessageSquare className="w-4 h-4" />
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [me, setMe] = useState<{ id?: string; email?: string; fullName?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newType, setNewType] = useState<'direct' | 'group'>('direct')
  const [newRecipients, setNewRecipients] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const myProfileId = me?.id || null

  function loadConversations() {
    setLoading(true)
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((d) => setConversations(Array.isArray(d.conversations) ? d.conversations : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConversations()
    fetch('/api/team').then((r) => r.json()).then((d) => setTeam(Array.isArray(d) ? d : []))
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe({ id: d.id, email: d.email, fullName: d.fullName }))
  }, [])

  function loadMessages(conversationId: string) {
    setMessagesLoading(true)
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d.messages) ? d.messages : []))
      .finally(() => setMessagesLoading(false))
    fetch(`/api/conversations/${conversationId}/read`, { method: 'POST' }).then(() => {
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)))
    })
  }

  useEffect(() => {
    if (activeId) loadMessages(activeId)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeConversation = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId])

  async function send() {
    if (!draft.trim() || !activeId) return
    setSending(true)
    try {
      const res = await fetch(`/api/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      })
      if (res.ok) {
        const message = await res.json()
        setMessages((prev) => [...prev, message])
        setDraft('')
        loadConversations()
      } else {
        toast.error((await res.json()).error || 'Send failed')
      }
    } finally {
      setSending(false)
    }
  }

  async function createConversation() {
    if (newRecipients.length === 0) {
      toast.error('Select at least one recipient')
      return
    }
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newType,
        participant_ids: newRecipients,
      }),
    })
    if (res.ok) {
      const conversation = await res.json()
      setShowNew(false)
      setNewRecipients([])
      loadConversations()
      setActiveId(conversation.id)
    } else {
      toast.error((await res.json()).error || 'Could not start conversation')
    }
  }

  return (
    <div>
      <PageHeader
        icon={MessageSquare}
        eyebrow="Communications"
        title="Messages"
        description="Direct messages, group chats, and practice-area channels — the firm's internal communication engine, separate from client email."
        meta={[`${conversations.length} conversations`]}
        actions={
          <button className="btn btn-primary gap-2" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4" /> New message
          </button>
        }
      />

      {/* On mobile this shows exactly one pane at a time -- list OR thread,
          switched by whether a conversation is open -- rather than the
          list's min-w-[260px] squeezing the thread into an unusable sliver
          next to it. md+ restores the classic side-by-side messenger. */}
      <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] flex overflow-hidden h-[calc(100dvh-13rem)] md:h-[calc(100vh-14rem)] min-h-[420px] sm:min-h-[500px]">
        {/* Conversation list */}
        <div className={`w-full md:w-1/3 md:min-w-[260px] border-r border-[var(--color-border)] flex-col ${activeId ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <LoadingState />
            ) : conversations.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={MessageSquare} title="No conversations yet" description="Start one with the New message button." />
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left p-4 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-overlay)] transition-colors flex items-start gap-3 ${
                    activeId === c.id ? 'bg-[var(--color-surface-overlay)] border-l-2 border-l-[var(--color-accent)]' : 'border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface-overlay)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 text-[var(--color-text-muted)]">
                    <ConversationIcon type={c.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-sm truncate ${c.unread_count > 0 ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>
                        {conversationLabel(c, myProfileId)}
                      </span>
                      {c.last_message_at && (
                        <span className="text-[0.65rem] text-[var(--color-text-muted)] whitespace-nowrap pt-0.5">
                          {formatDate(c.last_message_at, 'short')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                      {c.last_message?.content || 'No messages yet'}
                    </div>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-white text-[0.65rem] font-semibold flex items-center justify-center">
                      {c.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread. Hidden on mobile until a conversation is selected --
            otherwise it renders as a useless empty pane no wider than a
            thumb next to the list. */}
        <div className={`flex-1 flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
              Select a conversation, or start a new one.
            </div>
          ) : (
            <>
              <div className="p-3 sm:p-4 border-b border-[var(--color-border)] flex items-center gap-2 sm:gap-3">
                {/* Exit point back to the list -- the only way back on
                    mobile, where the list pane is hidden while a thread
                    is open. */}
                <button
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                  className="md:hidden -ml-1 inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)] flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-[var(--color-surface-overlay)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] flex-shrink-0">
                  <ConversationIcon type={activeConversation.type} />
                </div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {conversationLabel(activeConversation, myProfileId)}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <LoadingState />
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No messages yet. Say hello.</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.actual_sender?.id === myProfileId
                    const displayName = m.display_sender?.full_name || m.actual_sender?.full_name || 'Unknown'
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-[var(--color-accent)] text-white rounded-br-sm' : 'bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-sm'}`}>
                          {!mine && <p className="text-xs font-semibold mb-0.5 opacity-80">{displayName}</p>}
                          {m.display_sender && m.display_sender.id !== m.actual_sender?.id && (
                            <p className="text-[0.65rem] opacity-70 mb-0.5">on behalf of {m.actual_sender?.full_name}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          <span className={`text-[0.65rem] block mt-1 ${mine ? 'text-white/70 text-right' : 'text-[var(--color-text-muted)]'}`}>
                            {formatDate(m.created_at, 'short')}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 sm:p-4 border-t border-[var(--color-border)]">
                <div className="flex items-end gap-2 bg-[var(--color-surface-overlay)]/30 border border-[var(--color-border)] rounded-xl p-2 focus-within:border-[var(--color-accent)] transition-colors">
                  {/* text-base (16px), not text-sm -- anything smaller makes
                      iOS Safari zoom the whole page in on focus. */}
                  <textarea
                    placeholder="Type your message..."
                    className="flex-1 max-h-32 min-h-11 bg-transparent outline-none text-base sm:text-sm py-2.5 sm:py-2 px-2 resize-none"
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                  />
                  <button
                    aria-label="Send message"
                    className="inline-flex items-center justify-center min-h-11 min-w-11 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                    onClick={send}
                    disabled={sending || !draft.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">New message</h2>
              <button aria-label="Close" className="btn btn-ghost inline-flex items-center justify-center min-h-11 min-w-11 p-1.5" onClick={() => setShowNew(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                className={`btn text-sm flex-1 ${newType === 'direct' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setNewType('direct'); setNewRecipients([]) }}
              >
                Direct
              </button>
              <button
                className={`btn text-sm flex-1 ${newType === 'group' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setNewType('group'); setNewRecipients([]) }}
              >
                Group
              </button>
            </div>

            <label className="label">
              {newType === 'direct' ? 'Recipient' : 'Recipients'}
            </label>
            <div className="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
              {team
                .filter((t) => t.profile_id && t.profile_id !== myProfileId)
                .map((t) => {
                  const selected = newRecipients.includes(t.profile_id!)
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (newType === 'direct') {
                          setNewRecipients([t.profile_id!])
                        } else {
                          setNewRecipients((prev) =>
                            selected ? prev.filter((id) => id !== t.profile_id) : [...prev, t.profile_id!]
                          )
                        }
                      }}
                      className={`w-full text-left px-3 py-2.5 min-h-11 text-sm flex items-center justify-between hover:bg-[var(--color-surface-overlay)] transition-colors ${selected ? 'bg-[var(--color-surface-overlay)]' : ''}`}
                    >
                      <span>
                        {t.full_name} <span className="text-[var(--color-text-muted)]">· {t.position}</span>
                      </span>
                      {selected && <span className="text-[var(--color-accent)] text-xs font-semibold">Selected</span>}
                    </button>
                  )
                })}
            </div>

            <button className="btn btn-primary w-full gap-2 mt-4" onClick={createConversation} disabled={newRecipients.length === 0}>
              <Send className="w-4 h-4" /> Start conversation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
