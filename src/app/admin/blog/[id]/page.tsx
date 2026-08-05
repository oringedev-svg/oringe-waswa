'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Save, Plus, Trash2, Loader2, Sparkles, AlertCircle, History, RotateCcw, FileClock, ArrowRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ImagePicker from '@/components/ui/ImagePicker'
import MarkdownEditor from '@/components/admin/blog/MarkdownEditor'
import { statusMeta, availableTransitions, transitionPermission, transitionLabel, type WorkflowStatus } from '@/lib/editorialWorkflow'
import { getStatusColor, formatDate } from '@/lib/utils'

interface Author {
  name: string
  email?: string
  role: 'primary' | 'co_author' | 'contributor'
  is_external: boolean
  group_name?: string
}

interface StatusHistoryEntry {
  id: string
  from_status: string | null
  to_status: string
  comments: string | null
  created_at: string
}

interface Revision {
  id: string
  data: { title?: string; excerpt?: string; content?: string; category?: string; tags?: string[]; cover_image_url?: string }
  note: string | null
  created_at: string
  author?: { full_name: string } | null
}

const CATEGORIES = ['Legal Updates', 'Corporate', 'Family Law', 'Criminal', 'Property', 'Immigration', 'Employment', 'Firm News', 'General']

// The happy-path phases shown as a horizontal stepper. 'changes_requested' and
// 'archived' are branches off this path, not phases on it, they're surfaced
// as banners/badges instead (see the Workflow card below).
const MAIN_PHASES: WorkflowStatus[] = ['draft', 'ready_for_review', 'approved', 'scheduled', 'published']

export default function BlogEditorPage() {
  const router = useRouter()
  const params = useParams()
  const isNew = !params.id || params.id === 'new'

  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'General',
    tags: '',
    status: 'draft' as WorkflowStatus,
    cover_image_url: '',
  })
  const [reviewComments, setReviewComments] = useState<string | null>(null)
  const [history, setHistory] = useState<StatusHistoryEntry[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [viewingRevision, setViewingRevision] = useState<Revision | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [authors, setAuthors] = useState<Author[]>([{ name: '', email: '', role: 'primary', is_external: false, group_name: '' }])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'editor' | 'comments'>('editor')
  // Bumped every time content is freshly loaded from the server (initial load,
  // after a save, after a status transition, after a revision restore) so the
  // WYSIWYG editor, whose `markdown` prop is read only on mount, remounts
  // with the latest server content. Never bumped by the user's own typing.
  const [contentVersion, setContentVersion] = useState(0)

  // Inline dialog for the two transitions that need extra input.
  const [dialog, setDialog] = useState<{ to: WorkflowStatus } | null>(null)
  const [comment, setComment] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  function loadPost() {
    if (isNew) return
    setLoading(true)
    Promise.all([
      fetch(`/api/blog/${params.id}`).then(r => r.json()),
      fetch('/api/me').then(r => (r.ok ? r.json() : { permissions: [] })),
    ]).then(([data, me]) => {
      setForm({
        title: data.title || '',
        excerpt: data.excerpt || '',
        content: data.content || '',
        category: data.category || 'General',
        tags: (data.tags || []).join(', '),
        status: data.status || 'draft',
        cover_image_url: data.cover_image_url || '',
      })
      setReviewComments(data.review_comments || null)
      setHistory(data.status_history || [])
      setRevisions(data.revisions || [])
      if (data.authors?.length) setAuthors(data.authors)
      setPermissions(me.permissions || [])
      setContentVersion(v => v + 1)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadPost() }, [params.id])

  useEffect(() => {
    if (isNew) fetch('/api/me').then(r => (r.ok ? r.json() : { permissions: [] })).then(me => setPermissions(me.permissions || []))
  }, [isNew])

  function updateForm(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function addAuthor() {
    setAuthors(a => [...a, { name: '', email: '', role: 'co_author', is_external: false, group_name: '' }])
  }

  function updateAuthor(i: number, key: string, value: string | boolean) {
    setAuthors(a => a.map((au, idx) => idx === i ? { ...au, [key]: value } : au))
  }

  function removeAuthor(i: number) {
    setAuthors(a => a.filter((_, idx) => idx !== i))
  }

  function canMakeTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    const perm = transitionPermission(from, to)
    return !perm || permissions.includes(perm)
  }

  async function transition(to: WorkflowStatus, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/blog/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to, ...extra }),
    })
    if (res.ok) {
      toast.success(transitionLabel(form.status, to) === 'Unpublish' ? 'Unpublished' : `Moved to ${statusMeta(to).label}`)
      setDialog(null)
      setComment('')
      setScheduledAt('')
      loadPost()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not update status')
    }
  }

  function handleTransitionClick(to: WorkflowStatus) {
    if (to === 'changes_requested' || to === 'scheduled') {
      setDialog({ to })
      return
    }
    if (to === 'draft' && (form.status === 'published' || form.status === 'scheduled')) {
      if (!confirm('Unpublish this post? It will be removed from the live site immediately.')) return
    }
    transition(to)
  }

  async function restoreRevision(revisionId: string) {
    if (!confirm('Restore this version? The current content will be saved as a new revision first, so nothing is lost.')) return
    setRestoring(revisionId)
    try {
      const res = await fetch(`/api/blog/${params.id}/revisions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: revisionId }),
      })
      if (res.ok) {
        toast.success('Version restored')
        setViewingRevision(null)
        loadPost()
      } else {
        toast.error('Could not restore version')
      }
    } finally {
      setRestoring(null)
    }
  }

  async function generateExcerpt() {
    if (!form.title || !form.content) { toast.error('Add title and content first'); return }
    setAiGenerating(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Write a compelling 2-sentence excerpt for a law firm blog post titled "${form.title}". Content preview: ${form.content.slice(0, 500)}` }],
        }),
      })
      const data = await res.json()
      updateForm('excerpt', data.response || '')
      toast.success('Excerpt generated!')
    } catch { toast.error('AI unavailable') }
    finally { setAiGenerating(false) }
  }

  async function save(submitForReview = false) {
    if (!form.title || !form.content) { toast.error('Title and content are required'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: submitForReview ? 'ready_for_review' : form.status,
        authors: authors.filter(a => a.name),
      }

      let res
      if (isNew) {
        res = await fetch('/api/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/blog/${params.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        toast.success(submitForReview ? 'Submitted for review' : 'Saved')
        if (isNew) {
          const data = await res.json()
          router.push(`/admin/blog/${data.id}`)
        } else {
          loadPost()
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Save failed')
      }
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  const canEdit = isNew || ['draft', 'changes_requested'].includes(form.status)
  const effectivePhaseIndex = form.status === 'changes_requested' ? 0 : MAIN_PHASES.indexOf(form.status)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
            {isNew ? 'New Blog Post' : 'Edit Blog Post'}
          </h1>
          {!isNew && (
            <span className={`badge ${getStatusColor(form.status)} text-xs mt-1 inline-block`}>{statusMeta(form.status).label}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="flex border-b border-[var(--color-border)] mb-6">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'comments'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Comments
          </button>
        </div>
      )}

      <div style={{ display: activeTab === 'editor' ? 'block' : 'none' }}>
        {/* Workflow: where this post is, and everything that can happen to it next, all in one place */}
      {!isNew && (
        <div className="card p-5 mb-6">
          <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Workflow</h3>

          {effectivePhaseIndex >= 0 && (
            <div className="flex items-center mb-5 overflow-x-auto">
              {MAIN_PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center flex-1 min-w-[90px] last:flex-none last:min-w-0">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: '90px' }}>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      i === effectivePhaseIndex ? 'bg-[var(--color-accent)]' : i < effectivePhaseIndex ? 'bg-[var(--color-accent)]/50' : 'bg-[var(--color-border)]'
                    }`} />
                    <span className={`text-[10px] uppercase tracking-wide text-center leading-tight ${
                      i === effectivePhaseIndex ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-muted)]'
                    }`}>
                      {statusMeta(phase).label}
                    </span>
                  </div>
                  {i < MAIN_PHASES.length - 1 && (
                    <div className={`h-px flex-1 ${i < effectivePhaseIndex ? 'bg-[var(--color-accent)]/50' : 'bg-[var(--color-border)]'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {reviewComments && form.status === 'changes_requested' && (
            <div className="flex gap-3 mb-4 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-400">Changes requested</div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{reviewComments}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <>
                <button onClick={() => save(false)} disabled={saving} className="btn btn-outline gap-2 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
                <button onClick={() => save(true)} disabled={saving} className="btn btn-primary gap-2 text-sm">
                  Submit for Review
                </button>
              </>
            ) : (
              availableTransitions(form.status)
                .filter((to) => to !== 'archived' && canMakeTransition(form.status, to))
                .map((to) => (
                  <button key={to} onClick={() => handleTransitionClick(to)} className="btn btn-outline gap-2 text-sm">
                    <ArrowRight className="w-4 h-4" /> {transitionLabel(form.status, to)}
                  </button>
                ))
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Title */}
          <div className="card p-5">
            <label className="label">Title *</label>
            <input disabled={!canEdit} className="input text-lg font-display" value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder="Post title…" />
          </div>

          {/* Excerpt */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Excerpt</label>
              <button onClick={generateExcerpt} disabled={aiGenerating || !canEdit} className="text-xs text-[var(--color-accent)] flex items-center gap-1 hover:underline disabled:opacity-40">
                {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Generate
              </button>
            </div>
            <textarea disabled={!canEdit} rows={3} className="input text-sm" value={form.excerpt} onChange={e => updateForm('excerpt', e.target.value)} placeholder="Short description shown in post listings…" />
          </div>

          {/* Content */}
          <div className="card p-5">
            <label className="label">Content *</label>
            <MarkdownEditor
              key={contentVersion}
              markdown={form.content}
              onChange={(md) => updateForm('content', md)}
              readOnly={!canEdit}
              placeholder="Write your post content…"
            />
          </div>

          {/* Authors */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Authors</h3>
              {canEdit && (
                <button onClick={addAuthor} className="btn btn-ghost text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Author
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {authors.map((author, i) => (
                <div key={i} className="p-4 border border-[var(--color-border)] rounded-lg relative">
                  {canEdit && (
                    <button onClick={() => removeAuthor(i)} className="absolute top-3 right-3 text-[var(--color-muted)] hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Name *</label>
                      <input disabled={!canEdit} className="input text-sm" value={author.name} onChange={e => updateAuthor(i, 'name', e.target.value)} placeholder="Author name or group name" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input disabled={!canEdit} type="email" className="input text-sm" value={author.email || ''} onChange={e => updateAuthor(i, 'email', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Role</label>
                      <select disabled={!canEdit} className="input text-sm" value={author.role} onChange={e => updateAuthor(i, 'role', e.target.value)}>
                        <option value="primary">Primary Author</option>
                        <option value="co_author">Co-Author</option>
                        <option value="contributor">Contributor</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Group Name (optional)</label>
                      <input disabled={!canEdit} className="input text-sm" value={author.group_name || ''} onChange={e => updateAuthor(i, 'group_name', e.target.value)} placeholder="e.g. Legal Research Team" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer col-span-2">
                      <input disabled={!canEdit} type="checkbox" checked={author.is_external} onChange={e => updateAuthor(i, 'is_external', e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
                      <span className="text-sm text-[var(--color-text-secondary)]">External / Guest author</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Settings */}
          <div className="card p-5 flex flex-col gap-4">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Post Settings</h3>

            <div>
              <label className="label">Category</label>
              <select disabled={!canEdit} className="input text-sm" value={form.category} onChange={e => updateForm('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Tags (comma-separated)</label>
              <input disabled={!canEdit} className="input text-sm" value={form.tags} onChange={e => updateForm('tags', e.target.value)} placeholder="law, kenya, corporate" />
            </div>

            <ImagePicker
              value={form.cover_image_url}
              onChange={(url) => updateForm('cover_image_url', url)}
              label="Cover Image"
            />
          </div>

          {/* Status history */}
          {!isNew && history.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--color-accent)]" /> History
              </h3>
              <div className="flex flex-col gap-3">
                {[...history].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((h) => (
                  <div key={h.id} className="text-xs border-l-2 border-[var(--color-border)] pl-3">
                    <div className="text-[var(--color-text-secondary)]">
                      {h.from_status ? `${statusMeta(h.from_status).label} → ` : ''}{statusMeta(h.to_status).label}
                    </div>
                    <div className="text-[var(--color-muted)]">{formatDate(h.created_at, 'short')}</div>
                    {h.comments && <div className="text-[var(--color-text-secondary)] mt-1 italic">"{h.comments}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revisions */}
          {!isNew && revisions.length > 0 && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <FileClock className="w-4 h-4 text-[var(--color-accent)]" /> Revisions
              </h3>
              <div className="flex flex-col gap-3">
                {revisions.map((rev) => (
                  <div key={rev.id} className="text-xs border-l-2 border-[var(--color-border)] pl-3">
                    <div className="text-[var(--color-text-secondary)] font-medium line-clamp-1">{rev.data.title || 'Untitled at this point'}</div>
                    <div className="text-[var(--color-muted)]">
                      {formatDate(rev.created_at, 'short')}{rev.author?.full_name ? ` · ${rev.author.full_name}` : ''}
                    </div>
                    {rev.note && <div className="text-[var(--color-muted)] italic mt-0.5">{rev.note}</div>}
                    <div className="flex gap-3 mt-1">
                      <button onClick={() => setViewingRevision(rev)} className="text-[var(--color-accent)] hover:underline">View</button>
                      <button
                        onClick={() => restoreRevision(rev.id)}
                        disabled={restoring === rev.id}
                        className="text-[var(--color-accent)] hover:underline flex items-center gap-1"
                      >
                        {restoring === rev.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
                    transition(dialog.to, { review_comments: comment })
                  } else {
                    if (!scheduledAt) { toast.error('Pick a date and time'); return }
                    transition(dialog.to, { scheduled_at: new Date(scheduledAt).toISOString() })
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

      {activeTab === 'comments' && (
        <CommentsManager postId={params.id as string} />
      )}

      {/* Revision preview modal */}
      {viewingRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setViewingRevision(null)}>
          <div className="card p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)]">
                {formatDate(viewingRevision.created_at, 'short')}{viewingRevision.author?.full_name ? ` · ${viewingRevision.author.full_name}` : ''}
              </h3>
              <button onClick={() => setViewingRevision(null)} className="btn btn-ghost p-1.5 !px-1.5" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm flex flex-col gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1">Title</div>
                <div className="text-[var(--color-text-primary)]">{viewingRevision.data.title}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1">Excerpt</div>
                <div className="text-[var(--color-text-secondary)]">{viewingRevision.data.excerpt}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-1">Content</div>
                <pre className="whitespace-pre-wrap font-body text-[var(--color-text-secondary)] text-xs">{viewingRevision.data.content}</pre>
              </div>
            </div>
            <button
              onClick={() => restoreRevision(viewingRevision.id)}
              disabled={restoring === viewingRevision.id}
              className="btn btn-primary text-sm gap-2 mt-4 w-full"
            >
              {restoring === viewingRevision.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Restore This Version
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentsManager({ postId }: { postId: string }) {
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch(`/api/blog/comments?post_id=${postId}&pending=true`)
      .then((r) => r.json())
      .then((data) => setComments(data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [postId])

  async function updateComment(id: string, updates: any) {
    const res = await fetch('/api/blog/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) {
      toast.success('Comment updated')
      load()
    } else {
      toast.error('Failed to update comment')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  if (comments.length === 0) {
    return <div className="card p-12 text-center text-[var(--color-muted)]">No comments yet.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.map((c) => (
        <div key={c.id} className="card p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="font-medium text-[var(--color-text-primary)]">{c.author_name}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{c.author_email} · {formatDate(c.created_at, 'short')}</div>
            </div>
            <div>
              {c.is_approved ? (
                <span className="badge bg-green-500/10 text-green-600 text-xs">Approved</span>
              ) : (
                <span className="badge bg-amber-500/10 text-amber-600 text-xs">Pending</span>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4 bg-[var(--color-surface-overlay)] p-3 rounded">{c.content}</p>
          
          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 mt-2">
            {!c.is_approved ? (
              <button onClick={() => updateComment(c.id, { is_approved: true })} className="btn btn-outline text-xs self-start">
                Approve Comment
              </button>
            ) : (
              <button onClick={() => updateComment(c.id, { is_approved: false })} className="btn btn-outline text-xs self-start text-red-500 hover:border-red-500">
                Unapprove
              </button>
            )}
            
            <div className="mt-2">
              <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2 block">Admin Reply</label>
              <div className="flex gap-2">
                <input 
                  className="input text-sm flex-1" 
                  defaultValue={c.admin_reply || ''} 
                  placeholder="Write a reply as admin..."
                  onBlur={(e) => {
                    if (e.target.value !== (c.admin_reply || '')) {
                      updateComment(c.id, { admin_reply: e.target.value })
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
