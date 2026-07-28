'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Scale, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m the Oringe Waswa & Akude Advocates LLP virtual assistant. How can I help you today? I can answer questions about our legal services, help you book an appointment, or guide you through our application processes.',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    fetch('/api/analytics/chat-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userMsg.content }),
    }).catch(() => {})
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })) }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response || 'Sorry, I could not process that.', timestamp: new Date().toISOString() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Please try again or contact us directly.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {open && (
        <div
          className={cn(
            'mb-4 flex flex-col rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-xl)] overflow-hidden transition-all duration-300',
            'bg-[var(--color-surface)]',
            minimized ? 'h-12' : 'w-80 sm:w-96 h-[520px]'
          )}
          style={{ width: minimized ? '320px' : undefined }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]"
            style={{ background: 'var(--color-text-primary)' }}>
            <div className="w-7 h-7 bg-[var(--color-accent)] rounded-sm flex items-center justify-center flex-shrink-0">
              <Scale className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--color-primary-900)] font-display truncate">
                OW Legal Assistant
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Online</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setMinimized(!minimized)} className="p-1 hover:opacity-70 transition-opacity text-[var(--color-muted)]">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1 hover:opacity-70 transition-opacity text-[var(--color-muted)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-[var(--color-accent)] text-white rounded-br-sm'
                          : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-bl-sm text-[var(--color-text-secondary)]'
                      )}
                    >
                      <ReactMarkdown className="prose prose-sm max-w-none [&>p]:mb-1 [&>p]:last:mb-0 [&>ul]:my-1 [&>ul]:pl-4 [&>li]:my-0.5 [&_a]:text-[var(--color-accent)]">
                        {msg.content}
                      </ReactMarkdown>
                    </div>
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

              {/* Quick Replies */}
              <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                {['Book appointment', 'Our services', 'Contact info', 'Track submission'].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="px-3 pb-3 flex gap-2 items-end">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type your message…"
                  className="input text-sm resize-none"
                  style={{ minHeight: '38px', maxHeight: '100px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="btn btn-primary !p-2.5 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => { setOpen(!open); setMinimized(false) }}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-[var(--shadow-xl)] transition-all duration-300',
          'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)] hover:scale-105 active:scale-95'
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  )
}
