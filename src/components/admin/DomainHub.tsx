'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ADMIN_DOMAINS, type AdminDomain } from '@/lib/adminDomains'

interface Overview {
  attention: { label: string; count: number; href: string; tone: 'risk' | 'warn' }[]
  website: { newInquiries7d: number; pendingTriage: number; subscribers: number; publishedPosts: number }
  clients: { pipeline: number; activeMatters: number; stalled: number; portalClients: number }
  staff: { staffAccounts: number; teamMembers: number; unassignedActive: number }
  finance: { unbilledTotal: number; outstanding: number; collectedThisMonth: number; overdueInvoices: number }
}

interface Figure { label: string; value: string; alert?: boolean }

function figuresFor(key: AdminDomain['key'], o: Overview): Figure[] {
  switch (key) {
    case 'website':
      return [
        { label: 'Inquiries this week', value: String(o.website.newInquiries7d) },
        { label: 'Awaiting triage', value: String(o.website.pendingTriage), alert: o.website.pendingTriage > 0 },
        { label: 'Subscribers', value: String(o.website.subscribers) },
        { label: 'Published posts', value: String(o.website.publishedPosts) },
      ]
    case 'clients':
      return [
        { label: 'In pipeline', value: String(o.clients.pipeline) },
        { label: 'Active matters', value: String(o.clients.activeMatters) },
        { label: 'Stalled 7d+', value: String(o.clients.stalled), alert: o.clients.stalled > 0 },
        { label: 'Clients on the portal', value: String(o.clients.portalClients) },
      ]
    case 'staff':
      return [
        { label: 'Staff accounts', value: String(o.staff.staffAccounts) },
        { label: 'Team profiles', value: String(o.staff.teamMembers) },
        { label: 'Unassigned matters', value: String(o.staff.unassignedActive), alert: o.staff.unassignedActive > 0 },
      ]
    case 'finance':
      return [
        { label: 'Unbilled work', value: formatCurrency(o.finance.unbilledTotal), alert: o.finance.unbilledTotal > 0 },
        { label: 'Outstanding', value: formatCurrency(o.finance.outstanding) },
        { label: 'Collected this month', value: formatCurrency(o.finance.collectedThisMonth) },
        { label: 'Overdue invoices', value: String(o.finance.overdueInvoices), alert: o.finance.overdueInvoices > 0 },
      ]
  }
}

export default function DomainHub({ domainKey }: { domainKey: AdminDomain['key'] }) {
  const domain = ADMIN_DOMAINS.find(d => d.key === domainKey)!
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(r => (r.ok ? r.json() : null))
      .then(setOverview)
      .finally(() => setLoading(false))
  }, [])

  const toolHrefs = new Set(domain.tools.map(t => t.href))
  const attention = (overview?.attention || []).filter(a => toolHrefs.has(a.href))

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{domain.label}</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1 max-w-xl">{domain.description}</p>
      </div>

      {/* Live figures for this domain */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" /></div>
      ) : overview && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {figuresFor(domainKey, overview).map(f => (
              <div key={f.label} className="card px-4 py-2.5">
                <div className={`text-lg font-display font-semibold ${f.alert ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>{f.value}</div>
                <div className="text-xs text-[var(--color-muted)]">{f.label}</div>
              </div>
            ))}
          </div>

          {/* Decisions waiting inside this domain */}
          {attention.length > 0 && (
            <div className="card p-5 mb-6">
              <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--color-accent)]" /> Needs attention
              </h2>
              <div className="flex flex-col gap-1.5">
                {attention.map((item, i) => (
                  <Link key={i} href={item.href}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`badge text-xs ${item.tone === 'risk' ? 'status-rejected' : 'status-pending'}`}>{item.count}</span>
                      <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* The tools this domain hosts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {domain.tools.map(({ href, icon: Icon, label, description }) => (
          <Link key={label} href={href} className="card p-5 hover:border-[var(--color-accent)] transition-all group">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="text-[var(--color-accent)]" style={{ width: 18, height: 18 }} />
              </div>
              <span className="font-display font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">{label}</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
