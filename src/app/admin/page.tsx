'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Gavel, Inbox, Landmark, ListChecks, Scale } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import SectionCard from '@/components/admin/SectionCard'
import { PageHeader, StatusPill, LoadingState, EmptyState, type Tone } from '@/components/admin/ui'

interface Overview {
  attention: { label: string; count: number; href: string; urgency: 'overdue' | 'almost_overdue' | 'safe' }[]
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

interface MyTask {
  id: string
  title: string
  due_date: string | null
  status: string
  matter: { id: string; matter_number: string; title: string } | null
  submission: { id: string; tracking_code: string; submitter_name: string } | null
}

interface ReviewItem extends MyTask {
  assigneeName: string | null
}

type Urgency = 'overdue' | 'almost_overdue' | 'safe' | 'complete' | 'info'

// These were raw Tailwind palette classes (`bg-red-100 text-red-800
// border-red-200`) with no dark: variant, so in dark mode every badge on
// the dashboard rendered dark text on a near-white chip. Routed through the
// shared tones instead, which resolve from the --status-* tokens and are
// theme-aware by construction.
const URGENCY: Record<Urgency, { label: string; tone: Tone }> = {
  overdue: { label: 'Overdue', tone: 'overdue' },
  almost_overdue: { label: 'Almost overdue', tone: 'risk' },
  safe: { label: 'Safe', tone: 'safe' },
  complete: { label: 'Complete', tone: 'done' },
  info: { label: 'Info', tone: 'neutral' },
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [recent, setRecent] = useState<RecentSubmission[]>([])
  const [canTriage, setCanTriage] = useState(false)
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/overview').then(r => (r.ok ? r.json() : null)),
      fetch('/api/submissions?limit=5').then(r => r.json()),
      fetch('/api/my-desk').then(r => (r.ok ? r.json() : null)),
      // Same endpoint /desk already uses: whatever is assigned to this
      // signed-in person specifically, not the firm-wide queues above.
      fetch('/api/desk/overview').then(r => (r.ok ? r.json() : null)),
    ]).then(([overview, subs, myDesk, deskOverview]) => {
      setData(overview)
      setRecent(subs.data || [])
      // Only canTriage is used here; the desk's own item list is rendered
      // by "My tasks" below off /api/desk/overview.
      setCanTriage(Boolean(myDesk?.canTriage))
      setMyTasks(deskOverview?.tasks || [])
      setReviewQueue(deskOverview?.reviewQueue || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Loading your desk" />
  if (!data) return <EmptyState title="Could not load the dashboard" description="The overview endpoint did not respond. Reload the page, or check that you are still signed in." />

  const { attention, website, clients, staff, finance } = data
  const visibleAttention = urgencyFilter === 'all'
    ? attention
    : attention.filter(item => item.urgency === urgencyFilter)

  // Work lanes, not product modules: they answer "what should I deal with
  // now?" rather than "where does this feature live?".
  const workLanes = [
    {
      title: 'New instructions',
      description: 'Review new enquiries and decide the next step for each one.',
      value: website.pendingTriage,
      valueLabel: 'waiting for triage',
      href: '/admin/submissions',
      action: 'Review the inbox',
      icon: Inbox,
      urgency: 'safe' as Urgency,
    },
    {
      title: 'Matters to move',
      description: 'Pick up matters that are stalled, unassigned, or need a legal decision.',
      value: clients.stalled + staff.unassignedActive,
      valueLabel: 'need attention',
      href: '/admin/matters',
      action: 'Open matters',
      icon: Scale,
      urgency: ((clients.stalled + staff.unassignedActive) > 0 ? 'almost_overdue' : 'safe') as Urgency,
    },
    {
      title: 'Court & deadlines',
      description: 'See the firm’s upcoming appearances, meetings, and time-sensitive work.',
      value: 'View',
      valueLabel: 'the calendar',
      href: '/admin/court-calendar',
      action: 'Check the calendar',
      icon: Gavel,
      urgency: 'info' as Urgency,
    },
    {
      title: 'Money to resolve',
      description: 'Follow up overdue invoices and turn completed work into cash.',
      value: finance.overdueInvoices,
      valueLabel: finance.overdueInvoices === 1 ? 'invoice overdue' : 'invoices overdue',
      href: '/admin/invoices',
      action: 'Review billing',
      icon: Landmark,
      urgency: (finance.overdueInvoices > 0 ? 'overdue' : 'safe') as Urgency,
    },
  ]
  const visibleWorkLanes = workLanes.filter(lane => lane.href !== '/admin/submissions' || canTriage)

  // The four domains as one value loop: the website brings inquiries in,
  // client work carries them, staff do the work, finance collects.
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

  const todayStr = new Date().toISOString().slice(0, 10)
  const overdueTasks = myTasks.filter(t => t.due_date && t.due_date < todayStr).length

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Command Center"
        title="Your desk"
        description="Start with a decision that needs you. The supporting tools stay in the background until they are useful."
      />

      <section className="mb-10">
        <h2 className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)] mb-3">Where to start</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {visibleWorkLanes.map(lane => {
            const Icon = lane.icon
            const urgency = URGENCY[lane.urgency]
            return (
              <Link key={lane.title} href={lane.href} className="card p-5 hover:shadow-[var(--shadow-md)] transition-shadow group flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <div className="text-right">
                    <div className="font-display text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums leading-none">{lane.value}</div>
                    <div className="text-[0.68rem] text-[var(--color-text-muted)] mt-1">{lane.valueLabel}</div>
                  </div>
                </div>
                <h3 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  {lane.title}
                  {lane.urgency !== 'safe' && lane.urgency !== 'info' && <StatusPill tone={urgency.tone} dot>{urgency.label}</StatusPill>}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1.5 flex-1">{lane.description}</p>
                <span className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  {lane.action} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Tasks assigned specifically to this person, not the firm-wide
          queues above. Colour-coded and collapsible like every other admin
          section; open by default only when something is overdue, since
          that's the case where it should be the first thing seen. */}
      {myTasks.length > 0 && (
        <SectionCard
          title="My tasks"
          icon={ListChecks}
          color="blue"
          defaultOpen={overdueTasks > 0}
          badge={<StatusPill tone={overdueTasks > 0 ? 'overdue' : 'neutral'}>{overdueTasks > 0 ? `${overdueTasks} overdue` : String(myTasks.length)}</StatusPill>}
        >
          <div className="flex flex-col gap-1">
            {myTasks.map(task => {
              const overdue = Boolean(task.due_date && task.due_date < todayStr)
              return (
                <Link key={task.id} href={`/admin/assignments/${task.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-overlay)] transition-colors group">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">{task.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                      {task.matter ? `${task.matter.matter_number} · ${task.matter.title}` : task.submission ? task.submission.submitter_name : 'Unlinked'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.due_date && (
                      <StatusPill tone={overdue ? 'overdue' : 'safe'}>{formatDate(task.due_date, 'short')}</StatusPill>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Work handed out that's come back Submitted, waiting on this
          person's approve/reject decision. Previously invisible on the
          dashboard entirely, the only signal was a firm-wide count buried
          in "Decisions waiting for you" below, this shows exactly which
          ones and who submitted them. */}
      {reviewQueue.length > 0 && (
        <SectionCard
          title="Awaiting my review"
          icon={ListChecks}
          color="purple"
          defaultOpen={true}
          badge={<StatusPill tone="review">{reviewQueue.length}</StatusPill>}
        >
          <div className="flex flex-col gap-1">
            {reviewQueue.map(item => (
              <Link key={item.id} href={`/admin/assignments/${item.id}`}
                className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-overlay)] transition-colors group">
                <div className="min-w-0">
                  <div className="text-sm text-[var(--color-text-primary)] truncate">{item.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    {item.assigneeName ? `Submitted by ${item.assigneeName}` : 'Submitted'}
                    {item.matter ? ` · ${item.matter.matter_number}` : item.submission ? ` · ${item.submission.submitter_name}` : ''}
                  </div>
                </div>
                <StatusPill tone="review">Pending Review</StatusPill>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Needs attention, every item is a handoff waiting on a decision.
          Sits below the work lanes so it informs a choice you're already
          making, rather than greeting you with a wall of alerts. */}
      <div className="card p-6 mb-6 border-l-[3px]" style={{ borderLeftColor: attention.length ? 'var(--status-danger)' : 'var(--color-border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-display font-semibold text-[var(--color-text-primary)]">Decisions waiting for you</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Red means late. Amber needs attention soon. Green is safely in the normal queue.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by urgency">
            {(['all', 'overdue', 'almost_overdue', 'safe', 'complete', 'info'] as const).map(filter => {
              const selected = urgencyFilter === filter
              const label = filter === 'all' ? 'All' : URGENCY[filter].label
              const count = filter === 'all' ? attention.length : attention.filter(item => item.urgency === filter).length
              return (
                <button key={filter} onClick={() => setUrgencyFilter(filter)}
                  aria-pressed={selected}
                  className={`rounded-[var(--radius-sm)] border px-2.5 py-1 text-xs transition-colors ${
                    selected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'
                  }`}>
                  {label} <span className="tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
        {visibleAttention.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {attention.length === 0 ? 'Nothing is waiting on a decision. All handoffs are clear.' : 'Nothing in this category.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleAttention.map((item, i) => (
              <Link key={i} href={item.href}
                className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-overlay)] transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusPill tone={URGENCY[item.urgency].tone} dot>{item.count}</StatusPill>
                  <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* The first operational handoff: a person has reached the firm and
          needs a clear decision, not a choice of unrelated modules. */}
      <div className="card mb-10">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-[var(--color-border)]">
          <div>
            <h2 className="font-display font-semibold text-[var(--color-text-primary)]">New work to review</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Start with the enquiry; the client, conflict, matter, and documents should follow from it.</p>
          </div>
          <Link href="/admin/submissions" className="btn btn-outline !py-1.5 !px-3 text-xs flex-shrink-0">View all</Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {recent.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm p-6">No submissions yet.</p>
          ) : (
            recent.map(sub => (
              <Link key={sub.id} href={`/admin/submissions/${sub.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-[var(--color-surface-overlay)] transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{sub.submitter_name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-text-muted)]">
                    <span className="capitalize">{sub.type}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatDate(sub.created_at, 'short')}</span>
                  </div>
                </div>
                <StatusPill tone={sub.status === 'pending' ? 'risk' : 'neutral'}>{sub.status.replace(/_/g, ' ')}</StatusPill>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Firm areas are useful context, but they are intentionally secondary
          to the work lanes above. */}
      <section className="mb-10">
        <h2 className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)] mb-3">Firm areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {domains.map(({ title, href, color, image, figures, flow }) => (
            <div key={title} className="admin-domain-card">
              <Link href={href} className="admin-domain-card-head group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" />
                <span className="admin-domain-card-scrim" style={{ background: `linear-gradient(180deg, ${color}22 0%, ${color}cc 100%)` }} />
                <h3 className="admin-domain-card-title">{title}</h3>
              </Link>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {figures.map(f => (
                    <div key={f.label}>
                      <div className="font-display text-xl font-semibold text-[var(--color-text-primary)] tabular-nums" style={'alert' in f && f.alert ? { color } : undefined}>{f.value}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1 leading-tight">{f.label}</div>
                    </div>
                  ))}
                </div>
                <Link href={flow.href} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] pt-4 border-t border-[var(--color-border)] transition-colors">
                  {flow.label} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
