'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import PublicLayout from '@/components/layout/PublicLayout'
import { Clock, User, Tag, ChevronRight, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  cover_image_url?: string
  category: string
  tags: string[]
  reading_time_minutes: number
  published_at: string
  authors: { name: string; role: string }[]
}

const CATEGORIES = ['All', 'Legal Updates', 'Corporate', 'Family Law', 'Criminal', 'Property', 'Immigration', 'Firm News']

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  // Pick up ?search= from the navbar search on first load.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('search')
    if (q) setSearch(q)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '9' })
    if (category !== 'All') params.set('category', category)
    if (search) params.set('search', search)
    fetch(`/api/blog?${params}`)
      .then(r => r.json())
      .then(d => { setPosts(d.data || []); setTotal(d.count || 0) })
      .finally(() => setLoading(false))
  }, [category, page, search])

  return (
    <PublicLayout>
      {/* Header */}
      <div className="py-20" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Legal Knowledge</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Legal Blog</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">
            Insights, commentary, and updates from the Oringe Waswa & Akude Advocates LLP team of legal experts.
          </p>
        </div>
      </div>

      {/* Active search banner */}
      {search && (
        <div className="container mt-6">
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Showing results for <span className="font-medium text-[var(--color-text-primary)]">&ldquo;{search}&rdquo;</span>
            </span>
            <button onClick={() => { setSearch(''); setPage(1) }} className="text-xs text-[var(--color-accent)] hover:underline">Clear search</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="border-b border-[var(--color-border)] sticky top-16 z-40 bg-[var(--color-surface)]">
        <div className="container overflow-x-auto">
          <div className="flex gap-0 py-0">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1) }}
                className={`px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  category === cat
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--color-text-muted)]">No posts found in this category.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className={`card card-hover group overflow-hidden flex flex-col reveal stagger-${Math.min((posts.indexOf(post) % 3) + 1, 5)}`}>
                    {/* Cover */}
                    <div className="relative h-48 bg-[var(--color-surface-overlay)] overflow-hidden">
                      {post.cover_image_url ? (
                        <Image src={post.cover_image_url} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-display text-5xl text-[var(--color-accent)]/20">{post.category.charAt(0)}</span>
                        </div>
                      )}
                      {post.category && post.category.toLowerCase() !== 'general' && (
                        <span className="absolute top-3 left-3 badge status-active text-xs">{post.category}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">{post.title}</h2>
                      {post.excerpt && (
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4 line-clamp-3 flex-1">{post.excerpt}</p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-[var(--color-muted)] mt-auto pt-3 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {post.authors?.[0]?.name || 'OW Team'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.reading_time_minutes} min
                          </span>
                        </div>
                        <span>{post.published_at ? formatDate(post.published_at, 'short') : ''}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {total > 9 && (
                <div className="flex justify-center gap-3 mt-12">
                  {page > 1 && (
                    <button onClick={() => setPage(p => p - 1)} className="btn btn-outline">Previous</button>
                  )}
                  <span className="flex items-center px-4 text-sm text-[var(--color-muted)]">
                    Page {page} of {Math.ceil(total / 9)}
                  </span>
                  {page * 9 < total && (
                    <button onClick={() => setPage(p => p + 1)} className="btn btn-outline gap-2">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
