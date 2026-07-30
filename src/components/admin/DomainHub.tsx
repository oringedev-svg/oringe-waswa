'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ADMIN_DOMAINS, type AdminDomain } from '@/lib/adminDomains'
import { PageHeader, StatCard, StatusPill, LoadingState, type Tone } from '@/components/admin/ui'
import type { SectionColor } from '@/lib/sectionColors'

// `urgency`, not `tone`. /api/dashboard/overview has always sent urgency;
// this component read `item.tone`, which was undefined on every row, so the
// risk styling below never once applied and every item rendered as pending.
type Urgency = 'overdue' | 'almost_overdue' | 'safe'

interface Overview {
  attention: { label: string; count: number; href: string; urgency: Urgency }[]
  website: { newInquiries7d: number; pendingTriage: number; subscribers: number; publishedPosts: number }
  clients: { pipeline: number; activeMatters: number; stalled: number; portalClients: number }
  staff: { staffAccounts: number; teamMembers: number; unassignedActive: number }
  finance: { unbilledTotal: number; outstanding: number; collectedThisMonth: number; overdueInvoices: number }
}

const URGENCY_TONE: Record<Urgency, Tone> = {
  overdue: 'overdue',
  almost_overdue: 'risk',
  safe: 'done',
}

// Each domain borrows the section colour of what it is about, so the hub
// reads as part of the same system as the cards inside it.
const DOMAIN_COLOR: Record<AdminDomain['key'], SectionColor> = {
  website: 'blue',
  clients: 'purple',
  staff: 'purple',
  finance: 'gold',
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
  const color = DOMAIN_COLOR[domainKey]

  return (
    <div>
      <PageHeader icon={domain.icon} eyebrow="Domain" title={domain.label} description={domain.description} />

      {loading ? (
        <LoadingState />
      ) : overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {figuresFor(domainKey, overview).map(f => (
              <StatCard
                key={f.label}
                label={f.label}
                value={f.value}
                color={f.alert ? 'red' : color}
                emphasis={f.alert}
              />
            ))}
          </div>

          {/* Decisions waiting inside this domain. Kept above the tool grid
              because a queue with something in it outranks navigation. */}
          {attention.length > 0 && (
            <div className="card p-5 mb-6 border-l-[3px]" style={{ borderLeftColor: 'var(--status-danger)' }}>
              <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--status-danger)]" /> Needs attention
              </h2>
              <div className="flex flex-col gap-1">
                {attention.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-overlay)] transition-colors group"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <StatusPill tone={URGENCY_TONE[item.urgency]}>{item.count}</StatusPill>
                      <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <h2 className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)] mb-3">
        Tools in {domain.label}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {domain.tools.map(({ href, icon: Icon, label, description }) => (
          <Link key={label} href={href} className="card p-5 hover:shadow-[var(--shadow-md)] transition-shadow group">
            <div className="flex items-center gap-2.5 mb-2">
              <Icon className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand)] transition-colors" />
              <span className="font-display font-semibold text-[var(--color-text-primary)]">{label}</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
