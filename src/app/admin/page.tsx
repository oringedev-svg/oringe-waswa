'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Gavel, Inbox, Landmark, ListChecks, Scale, CheckCircle2,
  AlertTriangle, Clock, TrendingUp, Users, DollarSign, ChevronRight, Briefcase, FileText
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PageHeader, StatusPill, LoadingState, EmptyState, type Tone } from '@/components/admin/ui'
import TeamCentre from '@/components/admin/TeamCentre'

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

const URGENCY: Record<Urgency, { label: string; tone: Tone }> = {
  overdue: { label: 'Overdue', tone: 'overdue' },
  almost_overdue: { label: 'Attention', tone: 'risk' },
  safe: { label: 'On Track', tone: 'safe' },
  complete: { label: 'Complete', tone: 'done' },
  info: { label: 'Notice', tone: 'neutral' },
}

// The firm-wide command centre: business metrics, decisions queue, and
// links into every domain. Reserved for the managing admin (profile.role
// === 'admin') -- everyone else lands on TeamCentre instead, see the
// router component below. A pupil or an individual advocate has no use
// for firm-wide unbilled-work totals or a submissions triage queue; their
// entire job is what's on their own desk.
function ExecutiveDashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [recent, setRecent] = useState<RecentSubmission[]>([])
  const [canTriage, setCanTriage] = useState(false)
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'decisions' | 'tasks' | 'review'>('decisions')
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/overview').then(r => (r.ok ? r.json() : null)),
      fetch('/api/submissions?limit=6').then(r => r.json()),
      fetch('/api/my-desk').then(r => (r.ok ? r.json() : null)),
      fetch('/api/desk/overview').then(r => (r.ok ? r.json() : null)),
    ]).then(([overview, subs, myDesk, deskOverview]) => {
      setData(overview)
      setRecent(subs.data || [])
      setCanTriage(Boolean(myDesk?.canTriage))
      setMyTasks(deskOverview?.tasks || [])
      setReviewQueue(deskOverview?.reviewQueue || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Preparing your workspace" />
  if (!data) return <EmptyState title="Unable to load workspace" description="The overview endpoint did not respond. Please refresh or verify your connection." />

  const { attention, website, clients, staff, finance } = data
  const todayStr = new Date().toISOString().slice(0, 10)
  const overdueTasks = myTasks.filter(t => t.due_date && t.due_date < todayStr).length

  const visibleAttention = urgencyFilter === 'all'
    ? attention
    : attention.filter(item => item.urgency === urgencyFilter)

  const workLanes = [
    {
      title: 'New Instructions',
      count: website.pendingTriage,
      badge: 'Waiting Triage',
      href: '/admin/submissions',
      icon: Inbox,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    },
    {
      title: 'Matters Needing Action',
      count: clients.stalled + staff.unassignedActive,
      badge: 'Stalled / Unassigned',
      href: '/admin/matters',
      icon: Scale,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Court & Deadlines',
      count: 'Calendar',
      badge: 'Schedule',
      href: '/admin/court-calendar',
      icon: Gavel,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Billing & Invoices',
      count: finance.overdueInvoices,
      badge: finance.overdueInvoices === 1 ? '1 Overdue' : `${finance.overdueInvoices} Overdue`,
      href: '/admin/invoices',
      icon: Landmark,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
  ]
  const visibleWorkLanes = workLanes.filter(lane => lane.href !== '/admin/submissions' || canTriage)

  const domains = [
    {
      title: 'Website & Content',
      href: '/admin/website',
      icon: FileText,
      accent: 'border-l-sky-500',
      stats: [
        { label: 'Inquiries (7d)', value: website.newInquiries7d },
        { label: 'Subscribers', value: website.subscribers },
        { label: 'Published Posts', value: website.publishedPosts },
      ],
    },
    {
      title: 'Client Practice',
      href: '/admin/clients',
      icon: Briefcase,
      accent: 'border-l-emerald-500',
      stats: [
        { label: 'In Pipeline', value: clients.pipeline },
        { label: 'Active Matters', value: clients.activeMatters },
        { label: 'Stalled (7d+)', value: clients.stalled, alert: clients.stalled > 0 },
      ],
    },
    {
      title: 'Team & Staff',
      href: '/admin/staff',
      icon: Users,
      accent: 'border-l-purple-500',
      stats: [
        { label: 'Staff Accounts', value: staff.staffAccounts },
        { label: 'Team Profiles', value: staff.teamMembers },
        { label: 'Unassigned', value: staff.unassignedActive, alert: staff.unassignedActive > 0 },
      ],
    },
    {
      title: 'Financial Overview',
      href: '/admin/finance',
      icon: DollarSign,
      accent: 'border-l-amber-500',
      stats: [
        { label: 'Unbilled Work', value: formatCurrency(finance.unbilledTotal) },
        { label: 'Outstanding', value: formatCurrency(finance.outstanding) },
        { label: 'Collected (Month)', value: formatCurrency(finance.collectedThisMonth) },
      ],
    },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Sleek Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
            Command Center
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Executive Workspace
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/submissions" className="btn btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3">
            <Inbox className="w-3.5 h-3.5" />
            Review Submissions ({website.pendingTriage})
          </Link>
          <Link href="/admin/matters" className="btn btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3">
            <Scale className="w-3.5 h-3.5" />
            Active Matters ({clients.activeMatters})
          </Link>
        </div>
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:border-[var(--color-accent)]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
            <span>Active Matters</span>
            <Scale className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display text-[var(--color-text-primary)] tabular-nums">
              {clients.activeMatters}
            </span>
            <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              {clients.pipeline} in pipeline
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:border-[var(--color-accent)]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
            <span>Awaiting Triage</span>
            <Inbox className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display text-[var(--color-text-primary)] tabular-nums">
              {website.pendingTriage}
            </span>
            <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
              {website.newInquiries7d} new (7d)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:border-[var(--color-accent)]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
            <span>Unbilled Work</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display text-[var(--color-text-primary)] tabular-nums">
              {formatCurrency(finance.unbilledTotal)}
            </span>
            <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              Ready to bill
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:border-[var(--color-accent)]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] font-medium">
            <span>Overdue Invoices</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display text-[var(--color-text-primary)] tabular-nums">
              {finance.overdueInvoices}
            </span>
            <span className={`text-[0.7rem] px-2 py-0.5 rounded-full font-medium ${
              finance.overdueInvoices > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {finance.overdueInvoices > 0 ? 'Requires follow-up' : 'All clear'}
            </span>
          </div>
        </div>
      </div>

      {/* Streamlined Work Lanes Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleWorkLanes.map(lane => {
          const Icon = lane.icon
          return (
            <Link
              key={lane.title}
              href={lane.href}
              className="group p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-overlay)] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${lane.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                    {lane.title}
                  </div>
                  <div className="text-[0.7rem] text-[var(--color-text-muted)] truncate">
                    {lane.badge}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </Link>
          )
        })}
      </div>

      {/* Main Split Grid: Left Interactive Action Center & Right Context Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7/12 width): Unified Interactive Action Hub */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
            {/* Action Hub Tabs */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 bg-[var(--color-surface-overlay)]/40">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('decisions')}
                  className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'decisions'
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Decisions ({attention.length})
                </button>

                {myTasks.length > 0 && (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'tasks'
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    My Tasks ({myTasks.length})
                    {overdueTasks > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>
                )}

                {reviewQueue.length > 0 && (
                  <button
                    onClick={() => setActiveTab('review')}
                    className={`py-3 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'review'
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-semibold'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Awaiting Review ({reviewQueue.length})
                  </button>
                )}
              </div>

              {activeTab === 'decisions' && (
                <div className="hidden sm:flex items-center gap-1">
                  {(['all', 'overdue', 'almost_overdue', 'safe'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setUrgencyFilter(f)}
                      className={`text-[0.68rem] px-2 py-0.5 rounded transition-colors ${
                        urgencyFilter === f
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'
                      }`}
                    >
                      {f === 'all' ? 'All' : URGENCY[f].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'decisions' && (
                <div className="space-y-1.5">
                  {visibleAttention.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                      All handoffs are clear. No pending decision required.
                    </div>
                  ) : (
                    visibleAttention.map((item, idx) => (
                      <Link
                        key={idx}
                        href={item.href}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusPill tone={URGENCY[item.urgency].tone} dot>
                            {item.count}
                          </StatusPill>
                          <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {item.label}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                      </Link>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-1.5">
                  {myTasks.map(task => {
                    const overdue = Boolean(task.due_date && task.due_date < todayStr)
                    return (
                      <Link
                        key={task.id}
                        href={`/admin/assignments/${task.id}`}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {task.title}
                          </div>
                          <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5 truncate">
                            {task.matter
                              ? `${task.matter.matter_number} · ${task.matter.title}`
                              : task.submission
                              ? task.submission.submitter_name
                              : 'General Task'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.due_date && (
                            <StatusPill tone={overdue ? 'overdue' : 'safe'}>
                              {formatDate(task.due_date, 'short')}
                            </StatusPill>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {activeTab === 'review' && (
                <div className="space-y-1.5">
                  {reviewQueue.map(item => (
                    <Link
                      key={item.id}
                      href={`/admin/assignments/${item.id}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                          {item.title}
                        </div>
                        <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5 truncate">
                          {item.assigneeName ? `Submitted by ${item.assigneeName}` : 'Submitted'}
                          {item.matter ? ` · ${item.matter.matter_number}` : ''}
                        </div>
                      </div>
                      <StatusPill tone="review">Pending Review</StatusPill>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clean Practice Areas Grid */}
          <div className="pt-2">
            <h2 className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] mb-3 font-semibold">
              Firm Operational Hubs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {domains.map(d => {
                const Icon = d.icon
                return (
                  <Link
                    key={d.title}
                    href={d.href}
                    className={`p-4 rounded-xl border border-[var(--color-border)] border-l-4 ${d.accent} bg-[var(--color-surface)] hover:bg-[var(--color-surface-overlay)] transition-all group`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {d.title}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-[var(--color-border)]/60">
                      {d.stats.map(s => (
                        <div key={s.label}>
                          <div className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                            {s.value}
                          </div>
                          <div className="text-[0.65rem] text-[var(--color-text-muted)] truncate">
                            {s.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5/12 width): Compact Activity & Submissions Feed */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Recent Submissions
                </h3>
              </div>
              <Link href="/admin/submissions" className="text-[0.7rem] font-medium text-[var(--color-accent)] hover:underline">
                View all ({website.pendingTriage})
              </Link>
            </div>

            <div className="divide-y divide-[var(--color-border)]/60">
              {recent.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-xs py-6 text-center">
                  No submissions recorded.
                </p>
              ) : (
                recent.map(sub => (
                  <Link
                    key={sub.id}
                    href={`/admin/submissions/${sub.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-[var(--color-surface-overlay)] transition-colors px-1 rounded-md"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                        {sub.submitter_name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[0.68rem] text-[var(--color-text-muted)]">
                        <span className="capitalize">{sub.type}</span>
                        <span>·</span>
                        <span>{formatDate(sub.created_at, 'short')}</span>
                      </div>
                    </div>
                    <StatusPill tone={sub.status === 'pending' ? 'risk' : 'neutral'}>
                      {sub.status.replace(/_/g, ' ')}
                    </StatusPill>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick System Summary Card */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)]/50 text-xs space-y-2">
            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Practice Overview
            </div>
            <p className="text-[var(--color-text-muted)] text-[0.72rem] leading-relaxed">
              Your practice currently manages <strong className="text-[var(--color-text-primary)]">{clients.activeMatters} active matters</strong> across <strong className="text-[var(--color-text-primary)]">{staff.staffAccounts} staff accounts</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Entry point for /admin: decides which workspace a signed-in staff member
// lands on. The managing admin gets the full ExecutiveDashboard; everyone
// else (pupils, individual advocates, anyone without the 'admin' role)
// gets TeamCentre. If a non-admin role is later granted broader
// permissions, extend TeamCentre itself with permission-conditional
// sections rather than routing them back into ExecutiveDashboard, it stays
// overkill for a single practice area's worth of work.
export default function AdminDashboard() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setRole(me?.role || null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Preparing your workspace" />

  return role === 'admin' ? <ExecutiveDashboard /> : <TeamCentre />
}
