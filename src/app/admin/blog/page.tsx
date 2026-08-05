'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Eye, Edit, Loader2, MessageSquare, ArrowRight } from 'lucide-react'
import { formatDate, getStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import { STATUSES, availableTransitions, statusMeta, transitionPermission, transitionLabel, type WorkflowStatus } from '@/lib/editorialWorkflow'

interface BlogPost {
  id: string
  title: string
  slug: string
  status: WorkflowStatus
  category: string
  views: number
  reading_time_minutes: number
  published_at?: string
  scheduled_at?: string
  created_at: string
  authors: { name: string; role: string }[]
  comments_count?: number
  pending_comments_count?: number
}

const FILTERS = ['all', ...STATUSES.map((s) => s.key)]

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [permissions, setPermissions] = useState<string[]>([])

  // Inline dialog state for transitions that need extra input
  const [dialog, setDialog] = useState<{ post: BlogPost; to: WorkflowStatus } | null>(null)
  const [comment, setComment] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ admin: 'true', limit: '50' })
    if (status !== 'all') params.set('status', status)
    // The firm-wide pending-comments fetch went with the global comments
    // page: each post now carries its own counts, so a whole extra request
    // for a number nothing renders is pure waste.
    Promise.all([
      fetch(`/api/blog?${params}`).then((r) => r.json()),
      fetch('/api/me').then((r) => (r.ok ? r.json() : { permissions: [] })),
    ]).then(([data, me]) => {
      setPosts(data.data || [])
      setPermissions(me.permissions || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  function canMakeTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    const perm = transitionPermission(from, to)
    return !perm || permissions.includes(perm)
  }

  async function transition(post: BlogPost, to: WorkflowStatus, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/blog/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to, ...extra }),
    })
    if (res.ok) {
      toast.success(transitionLabel(post.status, to) === 'Unpublish' ? 'Unpublished' : `Moved to ${statusMeta(to).label}`)
      setDialog(null)
      setComment('')
      setScheduledAt('')
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not update status')
    }
  }

  function handleTransitionClick(post: BlogPost, to: WorkflowStatus) {
    if (to === 'changes_requested' || to === 'scheduled') {
      setDialog({ post, to })
      return
    }
    if (to === 'draft' && (post.status === 'published' || post.status === 'scheduled')) {
      if (!confirm('Unpublish this post? It will be removed from the live site immediately.')) return
    }
    transition(post, to)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Blog Management</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Draft, review, approve, schedule, and publish.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/blog/new" className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Post
          </Link>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              status === s
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
            }`}>
            {s === 'all' ? 'All' : statusMeta(s).label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No posts found.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Authors</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Comments</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)] line-clamp-1 max-w-xs">{post.title}</div>
                    <div className="text-xs text-[var(--color-muted)]">{post.category} · {post.reading_time_minutes} min read</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {post.authors?.map((a) => a.name).join(', ') || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getStatusColor(post.status)} text-xs`}>{statusMeta(post.status).label}</span>
                    {post.status === 'scheduled' && post.scheduled_at && (
                      <div className="text-xs text-[var(--color-muted)] mt-1">{formatDate(post.scheduled_at, 'short')}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    {formatDate(post.published_at || post.created_at, 'short')}
                  </td>
                  {/* Total, plus a pending flag: "4" alone gives no hint that
                      one of them is waiting on moderation, and there's no
                      firm-wide comments queue to catch it any more. Links
                      into the post's own comments section. */}
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                    <Link href={`/admin/blog/${post.id}#comments`} className="inline-flex items-center gap-1.5 hover:text-[var(--color-accent)] transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {post.comments_count || 0}
                      {!!post.pending_comments_count && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[var(--status-warning)]/15 text-[var(--status-warning)] font-medium">
                          {post.pending_comments_count} pending
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {availableTransitions(post.status)
                        .filter((to) => to !== 'archived' && canMakeTransition(post.status, to))
                        .map((to) => (
                          <button
                            key={to}
                            onClick={() => handleTransitionClick(post, to)}
                            title={transitionLabel(post.status, to)}
                            className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-xs text-[var(--color-accent)] transition-colors flex items-center gap-1"
                          >
                            <ArrowRight className="w-3 h-3" />
                            {transitionLabel(post.status, to)}
                          </button>
                        ))}
                      {post.status === 'published' && (
                        <Link href={`/blog/${post.slug}`} target="_blank"
                          className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-muted)] transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                      )}
                      <Link href={`/admin/blog/${post.id}`}
                        className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-muted)] transition-colors">
                        <Edit className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transition dialog: request changes (needs a comment) or schedule (needs a date) */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card p-5 w-full max-w-sm">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-3">
              {dialog.to === 'changes_requested' ? 'Request changes' : 'Schedule publish'}
            </h3>
            {dialog.to === 'changes_requested' ? (
              <>
                <label className="label">Comments for the author</label>
                <textarea
                  className="input text-sm"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What needs to change before this can be approved?"
                />
              </>
            ) : (
              <>
                <label className="label">Publish date and time</label>
                <input
                  type="datetime-local"
                  className="input text-sm"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (dialog.to === 'changes_requested') {
                    if (!comment.trim()) { toast.error('Comment is required'); return }
                    transition(dialog.post, dialog.to, { review_comments: comment })
                  } else {
                    if (!scheduledAt) { toast.error('Pick a date and time'); return }
                    transition(dialog.post, dialog.to, { scheduled_at: new Date(scheduledAt).toISOString() })
                  }
                }}
                className="btn btn-primary text-sm flex-1"
              >
                Confirm
              </button>
              <button onClick={() => setDialog(null)} className="btn btn-outline text-sm flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
