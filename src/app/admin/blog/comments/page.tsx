'use client'
import { useEffect, useState } from 'react'
import { Check, X, MessageSquare, Reply, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  post_id: string
  author_name: string
  author_email: string
  content: string
  is_approved: boolean
  admin_reply?: string
  created_at: string
}

export default function BlogCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  function load() {
    setLoading(true)
    const pending = filter === 'pending'
    fetch(`/api/blog/comments?pending=${pending}`)
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  async function updateComment(id: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/blog/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) { toast.success('Comment updated!'); load() }
    else toast.error('Update failed')
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return
    await updateComment(id, { admin_reply: reply, is_approved: true })
    setReplyingTo(null)
    setReply('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Blog Comments</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Moderate reader comments</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['pending', 'approved', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : comments.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No {filter} comments.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map(comment => (
            <div key={comment.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-base text-[var(--color-accent)]">{comment.author_name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[var(--color-text-primary)]">{comment.author_name}</div>
                    <div className="text-xs text-[var(--color-muted)]">{comment.author_email} · {formatDate(comment.created_at, 'datetime')}</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {!comment.is_approved && (
                    <button onClick={() => updateComment(comment.id, { is_approved: true })}
                      className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Approve">
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="p-1.5 rounded bg-[var(--color-surface-overlay)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors" title="Reply">
                    <Reply className="w-4 h-4" />
                  </button>
                  <button onClick={() => updateComment(comment.id, { is_approved: false })}
                    className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Remove">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-relaxed">{comment.content}</p>

              {comment.admin_reply && (
                <div className="mt-3 ml-4 p-3 rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-surface-overlay)]">
                  <div className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider mb-1">Team Reply</div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{comment.admin_reply}</p>
                </div>
              )}

              {replyingTo === comment.id && (
                <div className="mt-3 flex gap-2">
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    className="input text-sm flex-1"
                    placeholder="Type your reply…"
                  />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => sendReply(comment.id)} className="btn btn-primary text-xs py-2">Send</button>
                    <button onClick={() => { setReplyingTo(null); setReply('') }} className="btn btn-ghost text-xs py-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
