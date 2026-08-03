'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Activity, ClipboardList, ListChecks, Users, UserRoundCheck, Workflow } from 'lucide-react'
import { PageHeader, LoadingState, StatusPill } from '@/components/admin/ui'

type Tab = 'Overview' | 'People' | 'Pools' | 'Queues' | 'Reviews' | 'Templates' | 'Automation'
const tabs: Tab[] = ['Overview', 'People', 'Pools', 'Queues', 'Reviews', 'Templates', 'Automation']

type Overview = { metrics: { openWork: number; blocked: number; awaitingReview: number; overdue: number; escalated: number; avgCompletionHours: number | null; avgReviewHours: number | null; slaHealthPct: number }; byStatus: { label: string; value: number }[]; upcoming: { id: string; due_date: string; status: string; matter?: { title: string } | null }[] }
type TeamMember = { id: string; full_name: string; position?: string }
type WorkItem = { id: string; title: string; due_at?: string | null; urgency?: string; activity_type?: { name: string } | null; matter?: { matter_number: string; title: string } | null }

const metricLabel: Record<string, string> = { openWork: 'Open work', blocked: 'Blocked', awaitingReview: 'Awaiting review', overdue: 'Overdue', escalated: 'Escalated', slaHealthPct: 'SLA health' }

export default function AssignmentsPage() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [people, setPeople] = useState<TeamMember[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetch('/api/assignments/overview').then(r => r.ok ? r.json() : null), fetch('/api/team?with_category=true').then(r => r.ok ? r.json() : []), fetch('/api/work-items?mode=queue').then(r => r.ok ? r.json() : { work_items: [] })])
      .then(([health, team, queue]) => { setOverview(health); setPeople(Array.isArray(team) ? team : team?.team || []); setWorkItems(queue.work_items || []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState label="Loading work orchestration" />
  const metrics = overview?.metrics

  return <div className="max-w-7xl mx-auto">
    <PageHeader icon={ClipboardList} eyebrow="Work Orchestration" title="Assignments" description="Firm-wide work health, ownership, queues and review flow—not a personal task list." />
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] mb-6" aria-label="Assignment workspace">
      {tabs.map(item => <button key={item} onClick={() => setTab(item)} className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === item ? 'border-[var(--color-brand)] text-[var(--color-brand)] font-medium' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>{item}</button>)}
    </nav>

    {tab === 'Overview' && <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {metrics && (['openWork', 'blocked', 'awaitingReview', 'overdue', 'escalated', 'slaHealthPct'] as const).map(key => <div key={key} className="card p-4"><p className="text-xs text-[var(--color-text-muted)]">{metricLabel[key]}</p><p className="text-2xl font-semibold mt-1">{metrics[key]}{key === 'slaHealthPct' ? '%' : ''}</p></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card p-5"><h2 className="font-semibold">Work by state</h2><div className="mt-4 space-y-3">{overview?.byStatus.map(row => <div key={row.label} className="flex items-center gap-3"><span className="w-28 text-sm text-[var(--color-text-secondary)] truncate">{row.label}</span><div className="flex-1 bg-[var(--color-surface-overlay)] rounded-full h-2"><div className="h-2 rounded-full bg-[var(--color-brand)]" style={{ width: `${Math.min(100, row.value * 8)}%` }} /></div><span className="text-sm font-medium">{row.value}</span></div>)}</div></section>
        <section className="card p-5"><h2 className="font-semibold">Upcoming deadlines</h2><div className="mt-3 divide-y divide-[var(--color-border)]">{overview?.upcoming.map(item => <Link key={item.id} href={`/admin/assignments/${item.id}`} className="flex justify-between gap-3 py-3 text-sm hover:text-[var(--color-brand)]"><span>{item.matter?.title || 'Unlinked work'}</span><span className="text-[var(--color-text-muted)]">{item.due_date}</span></Link>) || <p className="text-sm text-[var(--color-text-muted)]">No dated open work.</p>}</div></section>
      </div>
    </>}

    {tab === 'People' && <section><p className="text-sm text-[var(--color-text-muted)] mb-4">Open a person’s work portfolio to see capacity, current work, review history and completed work.</p><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{people.map(person => <Link key={person.id} href={`/admin/assignments/people/${person.id}`} className="card p-5 hover:shadow-[var(--shadow-md)]"><Users className="w-5 h-5 text-[var(--color-brand)]" /><h2 className="font-semibold mt-3">{person.full_name}</h2><p className="text-sm text-[var(--color-text-muted)]">{person.position || 'Team member'} · View work portfolio</p></Link>)}</div></section>}

    {(tab === 'Pools' || tab === 'Queues') && <section className="card overflow-hidden"><div className="p-5 border-b border-[var(--color-border)]"><h2 className="font-semibold">{tab === 'Pools' ? 'Pooled work' : 'Work queues'}</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">{tab === 'Pools' ? 'Unclaimed team work, ready for accountable ownership.' : 'Unclaimed work categorized by activity and source.'}</p></div><div className="divide-y divide-[var(--color-border)]">{workItems.map(item => <div key={item.id} className="p-4 flex items-center justify-between gap-4"><div><p className="font-medium text-sm">{item.title}</p><p className="text-xs text-[var(--color-text-muted)]">{item.activity_type?.name || item.matter?.title || 'General queue'}</p></div><div className="text-right"><StatusPill tone="review">Unclaimed</StatusPill><p className="text-xs text-[var(--color-text-muted)] mt-1">{item.due_at?.slice(0, 10) || 'No due date'}</p></div></div>)}</div></section>}

    {tab === 'Reviews' && <section className="card p-8 text-center"><UserRoundCheck className="w-7 h-7 mx-auto text-[var(--color-brand)]" /><h2 className="font-semibold mt-3">Review control</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">Review scoring and firm-level review metrics feed the People workspace and overview dashboard.</p><button className="btn btn-outline mt-4" onClick={() => setTab('Overview')}>View review health</button></section>}
    {tab === 'Templates' && <section className="card p-8 text-center"><ListChecks className="w-7 h-7 mx-auto text-[var(--color-brand)]" /><h2 className="font-semibold mt-3">Assignment templates</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">Templates will instantiate checklists and deliverables into each assignment; live work stays independent after creation.</p></section>}
    {tab === 'Automation' && <section className="card p-8 text-center"><Workflow className="w-7 h-7 mx-auto text-[var(--color-brand)]" /><h2 className="font-semibold mt-3">Automation and SLA</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">SLA policies, escalation chains, triggers and AI suggestions are surfaced here as the engine is configured.</p></section>}
  </div>
}
