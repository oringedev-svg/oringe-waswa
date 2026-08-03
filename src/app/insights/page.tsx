'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { Play, Headphones, Newspaper, BookOpen, PenLine, Loader2, ExternalLink, ArrowRight } from 'lucide-react'
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
      {featured.length > 0 ? (
        <div className="bg-[var(--band-slate)] text-[var(--on-band)] border-b border-[var(--color-border)]">
          <div className="container py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
              <div className="flex-1 lg:max-w-xl space-y-6">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--on-band-muted)] font-semibold">Featured Insight</span>
                <h1 className="font-display text-4xl lg:text-5xl font-light leading-tight">
                  {featured[0].title}
                </h1>
                {featured[0].description && (
                  <p className="text-lg text-[var(--on-band-muted)] leading-relaxed line-clamp-3">
                    {featured[0].description}
                  </p>
                )}
                <div className="pt-4 flex items-center gap-6">
                  <Link href={featured[0].href || '#'} className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.15em] font-semibold hover:opacity-80 transition-opacity">
                    Read More <ArrowRight className="w-4 h-4" />
                  </Link>
                  {(featured[0].type === 'article' || featured[0].type === 'news') && featured[0].description && (
                    <ReadAloud text={featured[0].description} title={featured[0].title} compact />
                  )}
                </div>
              </div>
              <div className="flex-1 w-full relative h-[300px] lg:h-[400px]">
                {featured[0].thumbnail_url ? (
                  <Image src={featured[0].thumbnail_url} alt={featured[0].title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/20">
                    <BookOpen className="w-12 h-12 text-[var(--on-band-muted)]" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 reveal bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
          <div className="container">
            <span className="eyebrow mb-4 block">Knowledge Hub</span>
            <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Insights</h1>
            <p className="text-[var(--color-text-muted)] max-w-xl">Videos, podcasts, news, and articles from our legal experts.</p>
          </div>
        </div>
      )}

      <section aria-label="Filter insights" className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="container flex gap-8 py-0 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`py-4 text-xs tracking-[0.1em] uppercase font-semibold whitespace-nowrap transition-colors border-b-2 ${
                filter === f
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </section>

      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[var(--color-text-muted)]">No content available yet.</div>
          ) : (
            <>
              {featured.length > 0 && (
                <div className="mb-12">
                  <InsightCard item={featured[0]} large fullWidth />
                </div>
              )}

              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
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
  const cardClass = `group insight-anchor overflow-hidden ${fullWidth ? 'insight-card-lead' : 'flex flex-col h-full'}`
  const body = <InsightCardBody item={item} large={large} fullWidth={fullWidth} Icon={Icon} />

  if (item.href) {
    return <Link id={item.id} href={item.href} className={cardClass}>{body}</Link>
  }
  return <div id={item.id} className={cardClass}>{body}</div>
}

function InsightCardBody({ item, large, fullWidth = false, Icon }: { item: InsightItem; large: boolean; fullWidth?: boolean; Icon: React.ElementType }) {
  return (
    <>
      <div className={`relative bg-[var(--color-surface-overlay)] overflow-hidden ${fullWidth ? 'insight-card-lead-media' : large ? 'h-64' : 'h-52'}`}>
        {item.thumbnail_url ? (
          <Image src={item.thumbnail_url} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface-overlay)]">
            <Icon className="w-8 h-8 text-[var(--color-border)]" />
          </div>
        )}

        {item.type === 'video' && item.media_url && (
          <a href={item.media_url} target="_blank" rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors z-10">
            <div className="w-12 h-12 bg-white flex items-center justify-center shadow-lg rounded-sm">
              <Play className="w-5 h-5 text-[var(--color-brand)] ml-1" />
            </div>
          </a>
        )}

        {/* Compact Read Aloud Icon */}
        {(item.type === 'article' || item.type === 'news') && item.description && (
          <div className="absolute top-3 right-3 z-20">
            <ReadAloud text={item.description} title={item.title} compact />
          </div>
        )}
      </div>

      <div className={`flex flex-col flex-1 ${fullWidth ? '' : 'pt-5'}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--color-brand)]">{TYPE_LABELS[item.type]}</span>
          <div className="flex-1 h-[1px] bg-[var(--color-border)] opacity-60"></div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{formatDate(item.published_at, 'short')}</span>
        </div>
        
        <h3 className="font-display text-xl sm:text-2xl font-medium text-[var(--color-text-primary)] mb-3 group-hover:text-[var(--color-brand)] transition-colors line-clamp-3 leading-snug">
          {item.title}
        </h3>
        
        {item.description && (
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-2 flex-1 mb-4">{item.description}</p>
        )}

        {item.type === 'audio' && item.media_url && (
          <audio controls className="w-full h-8 mb-4" style={{ accentColor: 'var(--color-brand)' }}>
            <source src={item.media_url} />
          </audio>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--color-muted)]">{item.source || ''}</span>
          {item.external_url && (
            <a href={item.external_url} target="_blank" rel="noopener noreferrer"
              className="text-[var(--color-brand)] hover:underline inline-flex items-center gap-1 text-xs uppercase tracking-wider font-semibold">
              Read <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </>
  )
}
