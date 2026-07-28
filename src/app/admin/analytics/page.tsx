'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Eye, MessageCircle, FileQuestion, TrendingUp } from 'lucide-react'

interface CountItem { label: string; count: number; id?: string }
interface Summary {
  range: number
  totalPageViews: number
  totalEnquiries: number
  topPages: CountItem[]
  topArticlesByRecentViews: CountItem[]
  topArticlesAllTime: CountItem[]
  topQueries: CountItem[]
  enquiriesByType: CountItem[]
  enquiriesByStatus: CountItem[]
  dailyEnquiries: { date: string; count: number }[]
}

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

function BarList({ items, max, hrefFor }: { items: CountItem[]; max?: number; hrefFor?: (item: CountItem) => string | undefined }) {
  const top = max ?? Math.max(...items.map((i) => i.count), 1)
  if (items.length === 0) return <p className="text-sm text-[var(--color-muted)]">No data for this period.</p>
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const href = hrefFor?.(item)
        const label = (
          <span className="text-[var(--color-text-secondary)] truncate">{item.label || 'Untitled'}</span>
        )
        return (
          <div key={item.label + (item.id || '')} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              {href ? <Link href={href} className="hover:text-[var(--color-accent)] transition-colors truncate">{label}</Link> : label}
              <span className="text-[var(--color-muted)] flex-shrink-0">{item.count}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${(item.count / top) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState(30)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/summary?range=${range}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [range])

  const maxDaily = data ? Math.max(...data.dailyEnquiries.map(d => d.count), 1) : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Analytics</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Traffic, popular content, and enquiries.</p>
        </div>
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                range === r.value ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-sm bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-[var(--color-text-primary)]">{data.totalPageViews}</div>
                <div className="text-xs text-[var(--color-muted)]">Page views · last {data.range} days</div>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-sm bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <FileQuestion className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-[var(--color-text-primary)]">{data.totalEnquiries}</div>
                <div className="text-xs text-[var(--color-muted)]">Enquiries · last {data.range} days</div>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-sm bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-[var(--color-text-primary)]">{data.topQueries.reduce((s, q) => s + q.count, 0)}</div>
                <div className="text-xs text-[var(--color-muted)]">Chat questions · last {data.range} days</div>
              </div>
            </div>
          </div>

          {/* Enquiries trend */}
          <div className="card p-5 mb-6">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" /> Enquiries Over Time
            </h3>
            {data.dailyEnquiries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No enquiries in this period.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {data.dailyEnquiries.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div
                      className="w-full bg-[var(--color-accent)] rounded-t-sm min-h-[2px] transition-opacity group-hover:opacity-70"
                      style={{ height: `${(d.count / maxDaily) * 100}%` }}
                      title={`${d.date}: ${d.count}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Popular Pages</h3>
              <BarList items={data.topPages} />
            </div>
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Popular Articles (all time)</h3>
              <BarList items={data.topArticlesAllTime} hrefFor={(i) => i.id ? `/admin/blog/${i.id}` : undefined} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Enquiries by Type</h3>
              <BarList items={data.enquiriesByType} />
            </div>
            <div className="card p-5">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Enquiries by Status</h3>
              <BarList items={data.enquiriesByStatus} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-2">What Visitors Are Asking</h3>
            <p className="text-xs text-[var(--color-muted)] mb-4">
              The site has no search bar, so this tracks questions asked to the public chat widget instead, the closest real signal to search intent.
            </p>
            <BarList items={data.topQueries} />
          </div>
        </>
      )}
    </div>
  )
}
