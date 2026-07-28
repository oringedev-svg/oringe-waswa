'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'

interface Overview {
  attention: { label: string; count: number; href: string; tone: 'risk' | 'warn' }[]
  website: { newInquiries7d: number; pendingTriage: number; subscribers: number; publishedPosts: number }
  clients: { pipeline: number; activeMatters: number; stalled: number; stageCounts: Record<string, number>; portalClients: number }
  staff: { staffAccounts: number; teamMembers: number; unassignedActive: number }
  finance: { unbilledTotal: number; outstanding: number; collectedThisMonth: number; overdueInvoices: number }
}

interface RecentSubmission {
  id: string
  tracking_code: string
  type: string
  status: string
  submitter_name: string
  created_at: string
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [recent, setRecent] = useState<RecentSubmission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/overview').then(r => (r.ok ? r.json() : null)),
      fetch('/api/submissions?limit=5').then(r => r.json()),
    ]).then(([overview, subs]) => {
      setData(overview)
      setRecent(subs.data || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!data) return <div className="text-center py-20 text-[var(--color-muted)]">Could not load the dashboard.</div>

  const { attention, website, clients, staff, finance } = data

  // The four domains as one value loop: the website brings inquiries in,
  // client management carries them through the pipeline, staff do the work,
  // finance turns the work into cash. Each card ends with its handoff.
  // Colour is the identifying mark now (a left rule + tinted title), so the
  // small icon-in-a-box that used to sit in each header is gone, redundant
  // once colour and the label already do that job.
  const IMG = 'https://images.unsplash.com/photo-'
  const IMGQ = '?auto=format&fit=crop&w=600&q=70'
  const domains = [
    {
      title: 'Website',
      href: '/admin/website',
      color: '#3b6e8f',
      image: `${IMG}1467232004584-a241de8bcf5d${IMGQ}`,
      // Website is public-facing content and channels only. Triage and
      // matters live under Clients, not here.
      figures: [
        { label: 'Inquiries this week', value: String(website.newInquiries7d) },
        { label: 'Subscribers', value: String(website.subscribers) },
        { label: 'Published posts', value: String(website.publishedPosts) },
      ],
      flow: { label: 'Manage content, media and settings', href: '/admin/website' },
    },
    {
      title: 'Clients',
      href: '/admin/clients',
      color: '#3f7a5c',
      image: `${IMG}1521737604893-d14cc237f11d${IMGQ}`,
      figures: [
        { label: 'In pipeline', value: String(clients.pipeline) },
        { label: 'Active matters', value: String(clients.activeMatters) },
        { label: 'Stalled 7d+', value: String(clients.stalled), alert: clients.stalled > 0 },
      ],
      flow: { label: `${website.pendingTriage} enquiries awaiting triage`, href: '/admin/submissions' },
    },
    {
      title: 'Staff',
      href: '/admin/staff',
      color: '#6b5580',
      image: `${IMG}1600880292203-757bb62b4baf${IMGQ}`,
      figures: [
        { label: 'Staff accounts', value: String(staff.staffAccounts) },
        { label: 'Team profiles', value: String(staff.teamMembers) },
        { label: 'Unassigned matters', value: String(staff.unassignedActive), alert: staff.unassignedActive > 0 },
      ],
      flow: { label: 'Manage roles and permissions', href: '/admin/users' },
    },
    {
      title: 'Finance',
      href: '/admin/finance',
      color: '#a97d2f',
      image: `${IMG}1450101499163-c8848c66ca85${IMGQ}`,
      figures: [
        { label: 'Unbilled work', value: formatCurrency(finance.unbilledTotal), alert: finance.unbilledTotal > 0 },
        { label: 'Outstanding', value: formatCurrency(finance.outstanding) },
        { label: 'Collected this month', value: formatCurrency(finance.collectedThisMonth) },
      ],
      flow: { label: finance.overdueInvoices > 0 ? `${finance.overdueInvoices} invoices overdue` : 'All invoices current', href: '/admin/invoices' },
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-4">
      <div className="mb-10">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Practice Operations</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1.5">Choose where to work. Details load once you're inside.</p>
      </div>

      {/* The four domains, the first thing you see, so you choose where to
          go before anything data-heavy competes for attention. Each carries
          a photo header so the four read as distinct destinations at a
          glance, not four near-identical stat blocks. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {domains.map(({ title, href, color, image, figures, flow }) => (
          <div key={title} className="admin-domain-card">
            <Link href={href} className="admin-domain-card-head group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" />
              <span className="admin-domain-card-scrim" style={{ background: `linear-gradient(180deg, ${color}22 0%, ${color}cc 100%)` }} />
              <h2 className="admin-domain-card-title">{title}</h2>
            </Link>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                {figures.map(f => (
                  <div key={f.label}>
                    <div className="font-display text-xl font-semibold text-[var(--color-text-primary)]" style={'alert' in f && f.alert ? { color } : undefined}>{f.value}</div>
                    <div className="text-xs text-[var(--color-muted)] mt-1 leading-tight">{f.label}</div>
                  </div>
                ))}
              </div>
              <Link href={flow.href} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] pt-4 border-t border-[var(--color-border)] transition-colors">
                {flow.label}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Needs attention, every item is a handoff waiting on a decision.
          Sits below the domain cards so it informs a choice you're already
          making, rather than greeting you with a wall of alerts. */}
      <div className="card p-6 mb-10">
        <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nothing is waiting on a decision. All handoffs are clear.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {attention.map((item, i) => (
              <Link key={i} href={item.href}
                className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`badge text-xs ${item.tone === 'risk' ? 'status-rejected' : 'status-pending'}`}>{item.count}</span>
                  <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                </div>
                <span className="text-xs text-[var(--color-muted)] group-hover:text-[var(--color-text-primary)] flex-shrink-0">Open</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Triage inbox, where the loop starts */}
      <div className="card mb-6">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)]">Triage Inbox</h2>
          <Link href="/admin/submissions" className="text-xs text-[var(--color-accent)] hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {recent.length === 0 ? (
            <p className="text-[var(--color-muted)] text-sm p-6">No submissions yet.</p>
          ) : (
            recent.map(sub => (
              <Link key={sub.id} href={`/admin/submissions/${sub.id}`}
                className="flex items-center justify-between p-5 hover:bg-[var(--color-surface-overlay)] transition-colors">
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{sub.submitter_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--color-muted)] capitalize">{sub.type}</span>
                    <span className="text-xs text-[var(--color-muted)]">·</span>
                    <span className="text-xs text-[var(--color-muted)]">{formatDate(sub.created_at, 'short')}</span>
                  </div>
                </div>
                <span className={`badge ${getStatusColor(sub.status)} text-xs`}>
                  {sub.status.replace(/_/g, ' ')}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
