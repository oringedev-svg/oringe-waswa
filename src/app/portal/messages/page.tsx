'use client'
import { useState } from 'react'
import { MessageSquare, Send, Paperclip, Search, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function PortalMessagesPage() {
  const [activeThread, setActiveThread] = useState(1)
  
  // Mock data for messages
  const threads = [
    { id: 1, subject: 'Update on OW-2026-001', advocate: 'Oringe Waswa', unread: true, lastMsg: 'The opposing counsel has agreed to the terms...', date: '2026-08-04T09:30:00Z' },
    { id: 2, subject: 'General Inquiry', advocate: 'Support Team', unread: false, lastMsg: 'Thank you. We have received the documents.', date: '2026-08-01T14:15:00Z' },
  ]

  const messages = [
    { id: 1, sender: 'advocate', text: 'Good morning, please review the latest draft when you have a moment. The opposing counsel has agreed to the terms we discussed.', date: '2026-08-04T09:30:00Z' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="mb-4 flex-shrink-0">
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
          Communication
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Messages
        </h1>
      </div>

      <div className="flex-1 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] shadow-xs flex overflow-hidden min-h-[500px]">
        {/* Sidebar */}
        <div className="w-1/3 min-w-[250px] border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-overlay)]/20">
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input 
                type="text" 
                placeholder="Search messages..." 
                className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.map(thread => (
              <button 
                key={thread.id}
                onClick={() => setActiveThread(thread.id)}
                className={`w-full text-left p-4 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-overlay)] transition-colors ${activeThread === thread.id ? 'bg-[var(--color-surface-overlay)] border-l-2 border-l-[var(--color-accent)]' : 'border-l-2 border-l-transparent'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-semibold truncate pr-2 ${thread.unread ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {thread.subject}
                  </span>
                  <span className="text-[0.65rem] text-[var(--color-text-muted)] whitespace-nowrap pt-0.5">
                    {formatDate(thread.date, 'short')}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] truncate mb-1">
                  {thread.advocate}
                </div>
                <div className={`text-xs truncate ${thread.unread ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
                  {thread.lastMsg}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[var(--color-surface)]">
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-overlay)] border border-[var(--color-border)] flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{threads.find(t => t.id === activeThread)?.subject}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{threads.find(t => t.id === activeThread)?.advocate}</p>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  msg.sender === 'client' 
                    ? 'bg-[var(--color-accent)] text-white rounded-br-sm' 
                    : 'bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-sm'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                  <span className={`text-[0.65rem] block mt-1 ${msg.sender === 'client' ? 'text-white/70 text-right' : 'text-[var(--color-text-muted)]'}`}>
                    {formatDate(msg.date, 'short')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-overlay)]/10">
            <div className="flex items-end gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-2 focus-within:border-[var(--color-accent)] transition-colors">
              <button className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea 
                placeholder="Type your message..." 
                className="flex-1 max-h-32 min-h-[40px] bg-transparent outline-none text-sm py-2 resize-none"
                rows={1}
              />
              <button className="p-2 bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] rounded-lg transition-colors flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
