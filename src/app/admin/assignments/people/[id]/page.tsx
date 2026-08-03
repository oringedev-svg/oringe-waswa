'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, Loader2 } from 'lucide-react'

type Workspace = { member: { full_name: string; position?: string }; capacity: { active: number; overdue: number; completedThisMonth: number; pendingReviews: number; avgReviewScore: number | null }; currentWork: { id: string; instructions?: string; status: string; health?: string; due_date?: string; matter?: { matter_number: string; title: string } | null }[]; recentlyCompleted: { id: string; instructions?: string; completed_at?: string; matter?: { title: string } | null }[] }

export default function PersonWorkPortfolio({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Workspace | null>(null)
  useEffect(() => { fetch(`/api/team-members/${params.id}/workspace`).then(r => r.ok ? r.json() : null).then(setData) }, [params.id])
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" /></div>
  const c = data.capacity
  return <div className="max-w-6xl mx-auto">
    <Link href="/admin/assignments" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-brand)] mb-5"><ArrowLeft className="w-4 h-4" /> Assignments</Link>
    <div className="card p-6 mb-6"><BriefcaseBusiness className="w-6 h-6 text-[var(--color-brand)]" /><h1 className="font-display text-2xl font-semibold mt-3">{data.member.full_name}</h1><p className="text-sm text-[var(--color-text-muted)]">{data.member.position || 'Work portfolio'}</p><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">{[['Active', c.active], ['Reviews pending', c.pendingReviews], ['Overdue', c.overdue], ['Completed this month', c.completedThisMonth], ['Avg review score', c.avgReviewScore?.toFixed(1) || '—']].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-[var(--color-surface-overlay)] p-3"><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="font-semibold text-lg">{value}</p></div>)}</div></div>
    <section className="card overflow-hidden mb-6"><div className="p-5 border-b border-[var(--color-border)]"><h2 className="font-semibold">Current work</h2><p className="text-sm text-[var(--color-text-muted)]">Work grouped by the matter it serves, with visible state and blockers.</p></div><div className="divide-y divide-[var(--color-border)]">{data.currentWork.map(item => <Link key={item.id} href={`/admin/assignments/${item.id}`} className="block p-4 hover:bg-[var(--color-surface-overlay)]"><div className="flex justify-between gap-4"><div><p className="font-medium">{item.matter?.title || item.instructions || 'Unlinked work'}</p><p className="text-sm text-[var(--color-text-muted)]">{item.instructions || item.matter?.matter_number || 'Assignment'}</p></div><div className="text-right text-sm"><p>{item.status}</p><p className="text-[var(--color-text-muted)]">{item.health || 'Healthy'}{item.due_date ? ` · due ${item.due_date}` : ''}</p></div></div></Link>)}{data.currentWork.length === 0 && <p className="p-5 text-sm text-[var(--color-text-muted)]">No active work.</p>}</div></section>
    <section className="card overflow-hidden"><div className="p-5 border-b border-[var(--color-border)]"><h2 className="font-semibold">Recently completed</h2></div><div className="divide-y divide-[var(--color-border)]">{data.recentlyCompleted.map(item => <Link key={item.id} href={`/admin/assignments/${item.id}`} className="block p-4 text-sm hover:bg-[var(--color-surface-overlay)]">{item.matter?.title || item.instructions || 'Assignment'} <span className="text-[var(--color-text-muted)]">· {item.completed_at?.slice(0, 10)}</span></Link>)}</div></section>
  </div>
}
