'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, MessageCircle, FileQuestion, TrendingUp, BarChart3 } from 'lucide-react'
import { PageHeader, StatCard, LoadingState, FilterTabs } from '@/components/admin/ui'

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

function BarList({ items, hrefFor }: { items: CountItem[]; hrefFor?: (item: CountItem) => string | undefined }) {
  if (items.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">No data for this period.</p>
  const top = Math.max(...items.map((i) => i.count), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const href = hrefFor?.(item)
        const label = <span className="truncate">{item.label || 'Untitled'}</span>
        return (
          <div key={item.label + (item.id || '')} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1 text-[var(--color-text-secondary)]">
              {href
                ? <Link href={href} className="hover:text-[var(--color-text-primary)] transition-colors truncate">{label}</Link>
                : label}
              <span className="text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">{item.count}</span>
            </div>
            <div className="h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${(item.count / top) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {description && <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
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
      <PageHeader
        icon={BarChart3}
        eyebrow="Website"
        title="Analytics"
        description="Traffic, popular content, and enquiries."
        meta={[`Last ${range} days`]}
        actions={
          <FilterTabs
            value={String(range)}
            onChange={(v) => setRange(Number(v))}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />

      {loading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <StatCard label="Page views" value={data.totalPageViews} hint={`Last ${data.range} days`} icon={Eye} color="blue" />
            <StatCard label="Enquiries" value={data.totalEnquiries} hint={`Last ${data.range} days`} icon={FileQuestion} color="green" emphasis />
            <StatCard
              label="Chat questions"
              value={data.topQueries.reduce((s, q) => s + q.count, 0)}
              hint={`Last ${data.range} days`}
              icon={MessageCircle}
              color="slate"
            />
          </div>

          <div className="card p-5 mb-6">
            <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" /> Enquiries over time
            </h2>
            {data.dailyEnquiries.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No enquiries in this period.</p>
            ) : (
              <div className="flex items-end gap-0.5 h-32" role="img" aria-label={`Daily enquiries over the last ${data.range} days`}>
                {data.dailyEnquiries.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t-[1px] min-h-[2px] bg-[var(--color-brand)] opacity-80 hover:opacity-100 transition-opacity"
                    style={{ height: `${(d.count / maxDaily) * 100}%` }}
                    title={`${d.date}: ${d.count}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <Panel title="Popular pages"><BarList items={data.topPages} /></Panel>
            <Panel title="Popular articles (all time)">
              <BarList items={data.topArticlesAllTime} hrefFor={(i) => i.id ? `/admin/blog/${i.id}` : undefined} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            <Panel title="Enquiries by type"><BarList items={data.enquiriesByType} /></Panel>
            <Panel title="Enquiries by status"><BarList items={data.enquiriesByStatus} /></Panel>
          </div>

          <Panel
            title="What visitors are asking"
            description="The site has no search bar, so this tracks questions asked to the public chat widget instead, the closest real signal to search intent."
          >
            <BarList items={data.topQueries} />
          </Panel>
        </>
      )}
    </div>
  )
}
