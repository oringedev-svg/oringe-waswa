'use client'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Send, MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Message {
  id: string
  sender_id: string
  senderName?: string
  message_type: 'Comment' | 'Review' | 'System' | 'Decision'
  content: string
  created_at: string
}

interface AssignmentMessagesProps {
  messages: Message[]
  onSendMessage?: (content: string) => void
  canComment?: boolean
  loading?: boolean
}

// Renders message text with any http(s) URL turned into a clickable link,
// so a link shared as part of a submission (Part A #8) is actually usable,
// not just a string sitting inside the discussion thread. Splitting on a
// capturing group isolates each URL into its own array element, so each
// part only needs a plain (non-stateful) prefix check, not a shared /g regex.
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline break-all">{part}</a>
      : <span key={i}>{part}</span>,
  )
}

const messageTypeConfig = {
  Comment: { icon: MessageCircle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  Review: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  Decision: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  System: { icon: MessageCircle, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
}

export default function AssignmentMessages({ messages, onSendMessage, canComment = false, loading = false }: AssignmentMessagesProps) {
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!newMessage.trim() || !onSendMessage) return
    setSending(true)
    try {
      await onSendMessage(newMessage)
      setNewMessage('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card">
      <div className="border-b border-[var(--color-border)] p-6">
        <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Discussion</h3>
        <p className="text-xs text-[var(--color-muted)] mt-1">All conversation tied to this work is here</p>
      </div>

      <div className="p-6 max-h-96 overflow-y-auto space-y-4">
        {messages && messages.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] text-center py-8">No messages yet</p>
        ) : (
          messages?.map(msg => {
            const config = messageTypeConfig[msg.message_type] || messageTypeConfig.Comment
            const Icon = config.icon
            return (
              <div key={msg.id} className={`border rounded-lg p-4 ${config.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <div>
                        <span className="font-medium text-sm text-[var(--color-text-primary)]">
                          {msg.senderName || 'System'}
                        </span>
                        <span className="text-xs text-[var(--color-muted)] ml-2">
                          {msg.message_type !== 'System' && msg.message_type}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-muted)]">
                        {formatDate(msg.created_at, 'short')}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-primary)] mt-2 whitespace-pre-wrap">
                      {linkify(msg.content)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canComment && (
        <div className="border-t border-[var(--color-border)] p-6">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Add a comment or question..."
              className="input flex-1 resize-none"
              rows={3}
              disabled={sending || loading}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending || loading}
              className="btn btn-primary self-end gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
