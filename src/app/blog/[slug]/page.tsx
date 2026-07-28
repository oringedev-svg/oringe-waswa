'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import PublicLayout from '@/components/layout/PublicLayout'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Clock, User, Eye, Loader2, ChevronRight, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'
import ReadAloud from '@/components/blog/ReadAloud'

interface Comment {
  id: string
  author_name: string
  author_email: string
  content: string
  admin_reply?: string
  replied_at?: string
  created_at: string
  parent_id?: string
  is_approved: boolean
}

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image_url?: string
  category: string
  tags: string[]
  reading_time_minutes: number
  views: number
  published_at: string
  authors: { name: string; role: string; group_name?: string; is_external: boolean }[]
  comments: Comment[]
}

export default function BlogPostPage() {
  const params = useParams()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentForm, setCommentForm] = useState({ author_name: '', author_email: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [commentDone, setCommentDone] = useState(false)

  useEffect(() => {
    if (!params.slug) return
    fetch(`/api/blog/${params.slug}`)
      .then(r => r.json())
      .then(d => setPost(d))
      .finally(() => setLoading(false))
  }, [params.slug])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentForm.author_name || !commentForm.author_email || !commentForm.content) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/blog/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post!.id, ...commentForm }),
      })
      if (res.ok) {
        setCommentDone(true)
        toast.success('Comment submitted for moderation!')
      } else toast.error('Comment submission failed')
    } catch { toast.error('Network error') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <PublicLayout>
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      </div>
    </PublicLayout>
  )

  if (!post) return (
    <PublicLayout>
      <div className="section container text-center">
        <p className="text-[var(--color-text-muted)]">Post not found.</p>
        <Link href="/blog" className="btn btn-outline mt-4">Back to Blog</Link>
      </div>
    </PublicLayout>
  )

  const approvedComments = post.comments?.filter(c => c.is_approved && !c.parent_id) || []

  return (
    <PublicLayout>
      {/* Hero */}
      {post.cover_image_url && (
        <div className="relative h-72 md:h-96 bg-[var(--color-surface-overlay)]">
          <Image src={post.cover_image_url} alt={post.title} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="section">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Article */}
            <article className="lg:col-span-3">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] mb-6">
                <Link href="/blog" className="hover:text-[var(--color-accent)]">Blog</Link>
                <ChevronRight className="w-3 h-3" />
                <span>{post.category}</span>
              </div>

              {post.category && post.category.toLowerCase() !== 'general' && (
                <span className="badge status-active mb-4">{post.category}</span>
              )}
              <h1 className="font-display font-semibold mb-6" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: 1.2 }}>
                {post.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-muted)] mb-8 pb-6 border-b border-[var(--color-border)]">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {post.authors?.length > 0
                    ? post.authors.map(a => a.group_name || a.name).join(', ')
                    : 'OW Team'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {post.reading_time_minutes} min read
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  {post.views} views
                </span>
                {post.published_at && (
                  <span>{formatDate(post.published_at, 'long')}</span>
                )}
              </div>

              {/* Read Aloud bar */}
              <ReadAloud text={post.content} title={post.title} />

              {/* Content */}
              <div className="prose max-w-none text-[var(--color-text-secondary)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
              </div>

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-[var(--color-border)]">
                  {post.tags.map(tag => (
                    <span key={tag} className="badge" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* Authors */}
              {post.authors?.length > 0 && (
                <div className="card p-6 mt-10">
                  <h3 className="font-display font-semibold text-lg mb-4">About the Author{post.authors.length > 1 ? 's' : ''}</h3>
                  <div className="flex flex-col gap-3">
                    {post.authors.map((a, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                          <span className="font-display text-lg text-[var(--color-accent)]">{(a.group_name || a.name).charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[var(--color-text-primary)]">{a.group_name || a.name}</div>
                          <div className="text-xs text-[var(--color-muted)] capitalize">{a.role.replace(/_/g, ' ')}{a.is_external ? ' · Guest Contributor' : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="mt-12">
                <h3 className="font-display font-semibold text-xl mb-6">
                  Comments ({approvedComments.length})
                </h3>

                {approvedComments.length === 0 ? (
                  <p className="text-[var(--color-muted)] text-sm mb-8">Be the first to comment!</p>
                ) : (
                  <div className="flex flex-col gap-6 mb-10">
                    {approvedComments.map(comment => (
                      <div key={comment.id} className="card p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                            <span className="font-display text-sm text-[var(--color-accent)]">{comment.author_name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[var(--color-text-primary)]">{comment.author_name}</div>
                            <div className="text-xs text-[var(--color-muted)]">{formatDate(comment.created_at, 'long')}</div>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{comment.content}</p>

                        {comment.admin_reply && (
                          <div className="mt-4 ml-6 p-4 rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-surface-overlay)]">
                            <div className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider mb-2">Reply from OW Team</div>
                            <p className="text-sm text-[var(--color-text-secondary)]">{comment.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment form */}
                <div className="card p-6">
                  <h4 className="font-display font-semibold text-lg mb-4">Leave a Comment</h4>
                  {commentDone ? (
                    <p className="text-green-600 text-sm">Your comment has been submitted and is awaiting moderation. Thank you!</p>
                  ) : (
                    <form onSubmit={submitComment} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="label">Name *</label>
                          <input className="input" value={commentForm.author_name}
                            onChange={e => setCommentForm(f => ({ ...f, author_name: e.target.value }))} required />
                        </div>
                        <div>
                          <label className="label">Email *</label>
                          <input type="email" className="input" value={commentForm.author_email}
                            onChange={e => setCommentForm(f => ({ ...f, author_email: e.target.value }))} required />
                        </div>
                      </div>
                      <div>
                        <label className="label">Comment *</label>
                        <textarea rows={4} className="input" value={commentForm.content}
                          onChange={e => setCommentForm(f => ({ ...f, content: e.target.value }))} required />
                      </div>
                      <button type="submit" disabled={submitting} className="btn btn-primary gap-2 self-start">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Comment
                      </button>
                      <p className="text-xs text-[var(--color-muted)]">Comments are moderated before publication.</p>
                    </form>
                  )}
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-6">
              <div className="card p-6">
                <h3 className="font-display font-semibold text-lg mb-4">Book a Consultation</h3>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">Have a legal question? Our attorneys are here to help.</p>
                <Link href="/appointments" className="btn btn-primary w-full justify-center text-sm">Book Now</Link>
              </div>
              <div className="card p-6">
                <h3 className="font-display font-semibold text-lg mb-4">More Articles</h3>
                <Link href="/blog" className="btn btn-outline w-full justify-center text-sm gap-2">
                  View All Posts <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
