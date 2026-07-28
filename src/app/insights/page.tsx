'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { Play, Headphones, Newspaper, BookOpen, PenLine, Loader2, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'
import ReadAloud from '@/components/blog/ReadAloud'

interface InsightItem {
  id: string
  title: string
  type: 'video' | 'audio' | 'news' | 'article' | 'firm_article'
  description?: string
  media_url?: string
  thumbnail_url?: string
  external_url?: string
  href?: string // internal permalink (firm articles link to /blog/[slug])
  source?: string
  category: string
  is_featured: boolean
  published_at: string
}

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  cover_image_url?: string
  category: string
  published_at: string
}

// "Firm Article" is the firm's own long-form editorial content (the Blog
// engine internally), folded into the single Insights browsing experience
// as one more content type, rather than living in a separate nav concept.
const TYPE_ICONS: Record<string, React.ElementType> = { video: Play, audio: Headphones, news: Newspaper, article: BookOpen, firm_article: PenLine }
const TYPE_LABELS: Record<string, string> = { video: 'Video', audio: 'Audio', news: 'News', article: 'Article', firm_article: 'Firm Article' }
const FILTERS = ['All', 'Firm Article', 'Video', 'Audio', 'News', 'Article']

export default function InsightsPage() {
  const [items, setItems] = useState<InsightItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    Promise.all([
      fetch('/api/insights?limit=24').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/blog?limit=24').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([insightsRes, blogRes]) => {
      const insights: InsightItem[] = insightsRes.data || []
      const articles: InsightItem[] = (blogRes.data || []).map((p: BlogPost) => ({
        id: `blog-${p.id}`,
        title: p.title,
        type: 'firm_article' as const,
        description: p.excerpt,
        thumbnail_url: p.cover_image_url,
        href: `/blog/${p.slug}`,
        category: p.category,
        is_featured: false,
        published_at: p.published_at,
      }))
      setItems([...insights, ...articles].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()))
    }).finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'All' ? items : items.filter(i => TYPE_LABELS[i.type] === filter)
  const featured = filtered.filter(i => i.is_featured)
  // Only the first featured item gets the full-width lead slot; any others
  // flagged featured still appear, in the grid, rather than disappearing.
  const rest = filtered.filter(i => i.id !== featured[0]?.id)

  return (
    <PublicLayout>
      <div className="py-20 reveal" style={{ background: 'var(--color-surface-raised))' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Knowledge Hub</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Insights</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">Videos, podcasts, news, and articles from our legal experts.</p>
        </div>
      </div>

      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-16 z-40">
        <div className="container flex gap-0 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                filter === f
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--color-text-muted)]">No content available yet.</div>
          ) : (
            <>
              {/* Featured, the lead story running the full width of the
                  column rather than sharing a row. Only one is featured at
                  a time now: two side by side made neither read as the
                  lead, which is the whole point of featuring one. Any
                  others flagged featured fall through into the grid below. */}
              {featured.length > 0 && (
                <div className="mb-12">
                  <InsightCard item={featured[0]} large fullWidth />
                </div>
              )}

              {/* All */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map(item => <InsightCard key={item.id} item={item} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

function InsightCard({ item, large = false, fullWidth = false }: { item: InsightItem; large?: boolean; fullWidth?: boolean }) {
  const Icon = TYPE_ICONS[item.type] || BookOpen
  // Full width switches the card from a vertical stack to a side-by-side
  // split, image left, text right, so a wide lead card does not become a
  // short image with a very long line of text under it.
  const cardClass = `card overflow-hidden group ${fullWidth ? 'insight-card-lead' : 'flex flex-col'}`
  const body = <InsightCardBody item={item} large={large} fullWidth={fullWidth} Icon={Icon} />

  // Firm articles link to their permalink; everything else stays on this page.
  if (item.href) {
    return <Link href={item.href} className={cardClass}>{body}</Link>
  }
  return <div className={cardClass}>{body}</div>
}

function InsightCardBody({ item, large, fullWidth = false, Icon }: { item: InsightItem; large: boolean; fullWidth?: boolean; Icon: React.ElementType }) {
  return (
    <>
      {/* Thumbnail / Media */}
      <div className={`relative bg-[var(--color-surface-overlay)] overflow-hidden ${fullWidth ? 'insight-card-lead-media' : large ? 'h-56' : 'h-44'}`}>
        {item.thumbnail_url ? (
          <Image src={item.thumbnail_url} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-sm uppercase tracking-widest text-[var(--color-accent)]/40">{TYPE_LABELS[item.type]}</span>
          </div>
        )}

        {/* Video overlay */}
        {item.type === 'video' && item.media_url && (
          <a href={item.media_url} target="_blank" rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 text-[var(--color-accent)] ml-1" />
            </div>
          </a>
        )}

        {/* Type badge */}
        <span className="absolute top-3 left-3 badge status-active text-xs">
          <Icon className="w-3 h-3" />
          {TYPE_LABELS[item.type]}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2 flex-1 mb-3">{item.description}</p>
        )}

        {/* Audio player */}
        {item.type === 'audio' && item.media_url && (
          <audio controls className="w-full h-8 mb-3" style={{ accentColor: 'var(--color-accent)' }}>
            <source src={item.media_url} />
          </audio>
        )}

        {/* Read Aloud for curated articles and news (not firm articles,             those already have a full reading page at their permalink) */}
        {(item.type === 'article' || item.type === 'news') && item.description && (
          <div className="px-5 pb-3">
            <ReadAloud text={item.description} title={item.title} />
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-muted)]">{item.source || item.category}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-muted)]">{formatDate(item.published_at, 'short')}</span>
            {item.external_url && (
              <a href={item.external_url} target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
