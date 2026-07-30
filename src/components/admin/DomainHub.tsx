'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ADMIN_DOMAINS, type AdminDomain } from '@/lib/adminDomains'
import { PageHeader, StatusPill, LoadingState, type Tone } from '@/components/admin/ui'
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

// Lean KPI chip — same style language as the redesigned admin pages
function KpiChip({ label, value, alert }: Figure) {
  return (
    <div
      className="flex flex-col justify-between px-4 py-3.5 rounded-xl border transition-colors"
      style={{
        background: alert
          ? 'color-mix(in srgb, var(--status-warning) 7%, var(--color-surface))'
          : 'var(--color-surface)',
        borderColor: alert
          ? 'color-mix(in srgb, var(--status-warning) 22%, transparent)'
          : 'var(--color-border)',
      }}
    >
      <div
        className="text-2xl font-semibold tabular-nums leading-none mb-1.5"
        style={{ color: alert ? 'var(--status-warning)' : 'var(--color-text-primary)' }}
      >
        {value}
      </div>
      <div className="text-[0.7rem] text-[var(--color-text-muted)]">{label}</div>
    </div>
  )
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
      <PageHeader icon={domain.icon} eyebrow="Domain" title={domain.label} />

      {loading ? (
        <LoadingState />
      ) : overview && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {figuresFor(domainKey, overview).map(f => (
              <KpiChip key={f.label} label={f.label} value={f.value} alert={f.alert} />
            ))}
          </div>

          {/* Attention queue — kept above the tool grid */}
          {attention.length > 0 && (
            <div
              className="flex flex-col gap-1 rounded-xl border px-4 py-3.5 mb-6"
              style={{
                background: 'color-mix(in srgb, var(--status-danger) 6%, var(--color-surface))',
                borderColor: 'color-mix(in srgb, var(--status-danger) 22%, transparent)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--status-danger)' }} />
                <span className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--status-danger)' }}>
                  Needs attention
                </span>
              </div>
              {attention.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center justify-between gap-3 py-2 px-2.5 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors group"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <StatusPill tone={URGENCY_TONE[item.urgency]}>{item.count}</StatusPill>
                    <span className="text-sm text-[var(--color-text-primary)] truncate">{item.label}</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tool grid */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Tools in {domain.label}
        </span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {domain.tools.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={label}
            href={href}
            className="group flex items-start gap-3.5 p-4 rounded-xl border bg-[var(--color-surface)] hover:border-[var(--color-brand)] hover:-translate-y-0.5 transition-all"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Icon className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand)] transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-[var(--color-text-primary)] leading-tight">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
              {description && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed line-clamp-2">{description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
