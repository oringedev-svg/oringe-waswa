'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2, Minimize2, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface PendingAction {
  resource: string
  operation: 'create' | 'update' | 'delete' | 'send'
  id?: string
  data?: Record<string, unknown>
  summary: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  pendingAction?: PendingAction
  actionResolved?: 'confirmed' | 'cancelled' | null
  actionResult?: { success: boolean; message: string }
}

const RESOURCE_LABELS: Record<string, string> = {
  team_members: 'Team Member',
  blog_posts: 'Blog Post',
  blog_comments: 'Blog Comment',
  submissions: 'Submission',
  appointments: 'Appointment',
  legal_matters: 'Legal Matter',
  legal_documents: 'Document',
  people: 'Person',
  gallery_images: 'Gallery Image',
  certificates: 'Certificate',
  insights: 'Insight',
  coverage_areas: 'Coverage Area',
  mail_subscribers: 'Mail Subscriber',
  mail_campaigns: 'Mail Campaign',
}

const OPERATION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  send: 'Send',
}

function isDestructive(op: string) {
  return op === 'delete' || op === 'send'
}

export default function AdminAIAssistant() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi, I'm the admin assistant. I can look things up and make changes for you (team members, blog posts, submissions, appointments, matters, and more). For anything that creates, edits, deletes, or sends something, I'll always show you exactly what I'm about to do first, and you'll need to confirm it.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [executingIndex, setExecutingIndex] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message || 'Sorry, I could not process that.',
          pendingAction: data.pendingAction || undefined,
          actionResolved: data.pendingAction ? null : undefined,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I'm having trouble connecting. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function confirmAction(index: number) {
    const msg = messages[index]
    const action = msg.pendingAction
    if (!action) return
    setExecutingIndex(index)
    try {
      const res = await fetch('/api/ai/admin-assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      const data = await res.json()
      const success = res.ok && data.success
      setMessages((prev) =>
        prev.map((m, i) =>
          i === index
            ? {
                ...m,
                actionResolved: 'confirmed',
                actionResult: {
                  success,
                  message: success
                    ? `Done, ${action.summary}`
                    : `Failed: ${data.error || 'Unknown error'}`,
                },
              }
            : m
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === index
            ? { ...m, actionResolved: 'confirmed', actionResult: { success: false, message: 'Network error while executing.' } }
            : m
        )
      )
    } finally {
      setExecutingIndex(null)
    }
  }

  function cancelAction(index: number) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionResolved: 'cancelled' } : m)))
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 left-4 sm:left-auto flex flex-col items-end">
      {open && (
        <div
          className={cn(
            'mb-4 flex flex-col rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-xl)] overflow-hidden transition-all duration-300 w-full',
            'bg-[var(--color-surface)]',
            // 384-416px fixed widths overflowed a 375px phone entirely (the
            // panel is right-anchored with no left constraint, so it just
            // ran off the left edge). w-full + the container's left-4
            // right-4 inset makes it fill the screen with margins instead;
            // sm+ restores the fixed floating-panel width.
            minimized ? 'h-12 sm:w-[24rem] sm:mb-4' : 'h-[min(600px,calc(100dvh-6rem))] sm:w-[24rem] md:w-[26rem]'
          )}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]"
            style={{ background: 'var(--color-text-primary)' }}
          >
            <div className="w-7 h-7 bg-[var(--color-accent)] rounded-sm flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-primary-900)] font-display truncate">
                Admin AI Assistant
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Can read and act (with confirmation)</span>
              </div>
            </div>
            <div className="flex gap-0.5 -mr-1.5">
              <button
                onClick={() => setMinimized(!minimized)}
                aria-label={minimized ? 'Expand' : 'Minimize'}
                className="inline-flex items-center justify-center min-h-9 min-w-9 hover:opacity-70 transition-opacity text-[var(--color-muted)]"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex items-center justify-center min-h-9 min-w-9 hover:opacity-70 transition-opacity text-[var(--color-muted)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex flex-col gap-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'max-w-[90%] rounded-xl px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-[var(--color-accent)] text-white rounded-br-sm'
                          : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-bl-sm text-[var(--color-text-secondary)]'
                      )}
                    >
                      <ReactMarkdown className="prose prose-sm max-w-none [&>p]:mb-1 [&>p]:last:mb-0 [&>ul]:my-1 [&>ul]:pl-4 [&>li]:my-0.5">
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Confirmation card for a proposed action */}
                    {msg.pendingAction && (
                      <div
                        className={cn(
                          'w-full max-w-[90%] rounded-lg border p-3 text-sm',
                          isDestructive(msg.pendingAction.operation)
                            ? 'border-red-300 bg-red-50 dark:bg-red-950/20'
                            : 'border-[var(--color-accent)] bg-[var(--color-surface-raised)]'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          {isDestructive(msg.pendingAction.operation) ? (
                            <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                          )}
                          <span className="font-semibold text-xs uppercase tracking-wide text-[var(--color-text-primary)]">
                            {OPERATION_LABELS[msg.pendingAction.operation]} · {RESOURCE_LABELS[msg.pendingAction.resource] || msg.pendingAction.resource}
                          </span>
                        </div>
                        <p className="text-[var(--color-text-secondary)] mb-2">{msg.pendingAction.summary}</p>
                        {msg.pendingAction.data && Object.keys(msg.pendingAction.data).length > 0 && (
                          <pre className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-2 mb-2 overflow-x-auto max-h-32">
                            {JSON.stringify(msg.pendingAction.data, null, 2)}
                          </pre>
                        )}

                        {msg.actionResolved === null && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmAction(i)}
                              disabled={executingIndex === i}
                              className={cn(
                                'btn !py-1.5 !px-3 text-xs flex-1',
                                isDestructive(msg.pendingAction.operation) ? 'bg-red-600 text-white hover:bg-red-700' : 'btn-primary'
                              )}
                            >
                              {executingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                            </button>
                            <button
                              onClick={() => cancelAction(i)}
                              disabled={executingIndex === i}
                              className="btn btn-outline !py-1.5 !px-3 text-xs flex-1"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {msg.actionResolved === 'confirmed' && msg.actionResult && (
                          <div
                            className={cn(
                              'flex items-start gap-1.5 text-xs font-medium pt-1',
                              msg.actionResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-600'
                            )}
                          >
                            {msg.actionResult.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            )}
                            <span>{msg.actionResult.message}</span>
                          </div>
                        )}

                        {msg.actionResolved === 'cancelled' && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] pt-1">
                            <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Cancelled, nothing was changed.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl rounded-bl-sm px-3 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-muted)]" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="px-3 pb-3 flex gap-2 items-end">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="e.g. Mark submission #A1 as accepted and notify the client"
                  className="input text-sm resize-none"
                  style={{ minHeight: '38px', maxHeight: '100px' }}
                />
                <button onClick={sendMessage} disabled={!input.trim() || loading} aria-label="Send" className="btn btn-primary !p-2.5 min-h-11 min-w-11 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => {
          setOpen(!open)
          setMinimized(false)
        }}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-[var(--shadow-xl)] transition-all duration-300',
          'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)] hover:scale-105 active:scale-95'
        )}
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>
    </div>
  )
}
