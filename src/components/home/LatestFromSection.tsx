'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useSetting } from '@/components/providers/SiteSettingsProvider'

// A tabbed roundup of everything the firm has published lately, borrowed
// from the Mastercard Foundation's "Latest from" block: one heading, a tab
// switcher, and a single "View All" that follows the active tab. Events are
// folded in here because nothing else on the homepage surfaces them.

type TabKey = 'news' | 'articles' | 'events'

const TABS: { key: TabKey; label: string; viewAll: string }[] = [
  { key: 'news', label: 'News', viewAll: '/insights' },
  { key: 'articles', label: 'Articles', viewAll: '/blog' },
  { key: 'events', label: 'Events', viewAll: '/events' },
]

interface Item {
  id: string
  title: string
  href: string
  date?: string
  meta?: string
  image?: string
}

function formatDate(v?: string) {
  if (!v) return ''
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface RawInsight { id: string; title: string; category?: string; thumbnail_url?: string; published_at?: string }
interface RawBlogPost { id: string; title: string; slug: string; category?: string; cover_image_url?: string; published_at?: string; reading_time_minutes?: number }
interface RawEvent { id: string; title: string; event_date?: string; location?: string; image_url?: string }

function mapInsights(list: RawInsight[]): Item[] {
  return list.map(it => ({ id: `n-${it.id}`, title: it.title, href: '/insights', date: it.published_at, meta: it.category, image: it.thumbnail_url }))
}
function mapBlogPosts(list: RawBlogPost[]): Item[] {
  return list.map(p => ({
    id: `a-${p.id}`, title: p.title, href: `/blog/${p.slug}`, date: p.published_at,
    meta: p.reading_time_minutes ? `${p.reading_time_minutes} min read` : p.category, image: p.cover_image_url,
  }))
}
function mapEvents(list: RawEvent[]): Item[] {
  return list.slice(0, 3).map(e => ({ id: `e-${e.id}`, title: e.title, href: '/events', date: e.event_date, meta: e.location, image: e.image_url }))
}

// No client-side fetch here any more, the three feeds arrive server-fetched
// from the homepage; only which tab is showing stays client-side state.
export default function LatestFromSection({ initialInsights, initialBlogPosts, initialEvents }: {
  initialInsights: RawInsight[]; initialBlogPosts: RawBlogPost[]; initialEvents: RawEvent[]
}) {
  const data: Record<TabKey, Item[]> = {
    news: mapInsights(initialInsights),
    articles: mapBlogPosts(initialBlogPosts),
    events: mapEvents(initialEvents),
  }

  // Open on the first tab that actually has something in it. A firm that
  // has published articles but no news yet should not land on an empty
  // News tab.
  const firstNonEmpty = (['news', 'articles', 'events'] as const).find(k => data[k].length > 0) ?? 'news'
  const [tab, setTab] = useState<TabKey>(firstNonEmpty)
  const firmName = useSetting<string>('firm_name', 'Oringe Waswa & Akude Advocates LLP')

  // The heading reads "Latest from Oringe Waswa & Akude", the entity suffix
  // trimmed off so it stays a sentence rather than a legal filing.
  const advMatch = firmName.search(/\bAdvocates?\b/i)
  const shortName = advMatch > -1 ? firmName.slice(0, advMatch).trim() : firmName

  const items = data[tab]
  const active = TABS.find(t => t.key === tab)!
  const hasAny = data.news.length || data.articles.length || data.events.length
  if (!hasAny) return null

  return (
    <section className="section section-wash seam-fade">
      <div className="container">
        <h2 className="font-display mb-8 reveal" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>
          Latest from {shortName}
        </h2>

        <div className="latest-tabs reveal">
          <div className="latest-tabs-list" role="tablist">
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`latest-tab ${tab === t.key ? 'is-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link href={active.viewAll} className="latest-viewall">
            <ArrowRight className="w-4 h-4" /> View All
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-10">Nothing published under {active.label.toLowerCase()} yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {items.map((it, i) => (
              <div key={it.id} className={`photo-card photo-card--wide reveal stagger-${Math.min(i + 1, 5)}`}>
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" />
                ) : (
                  <div className="photo-card-fallback"><span>{it.title.charAt(0)}</span></div>
                )}

                <div className="photo-card-scrim" />

                {tab === 'events' && it.date && (
                  <div className="event-date-badge">
                    <span className="event-date-badge-day">{new Date(it.date).getDate()}</span>
                    <span className="event-date-badge-month">
                      {new Date(it.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                )}

                <Link href={it.href} className="photo-card-hit" aria-label={it.title} />

                <div className="photo-card-body">
                  <span className="photo-card-title">{it.title}</span>
                  <span className="photo-card-eyebrow">
                    {[it.date ? formatDate(it.date) : null, it.meta].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
