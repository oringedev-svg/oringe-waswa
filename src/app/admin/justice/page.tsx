import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { JusticeDataService } from '@/lib/justice/service'
import { INSTITUTION_LABELS, type InstitutionType } from '@/lib/justice/types'
import { JUSTICE_ZONES } from '@/lib/justice/zones'
import { PageHeader } from '@/components/admin/ui'
import JusticeSearch from './JusticeSearch'

export default function JusticeHubPage() {
  const counts = JusticeDataService.getCounts()
  const issues = JusticeDataService.getIssues()
  const types = (Object.keys(INSTITUTION_LABELS) as InstitutionType[]).filter(type => type !== 'court')

  return (
    <div>
      <PageHeader
        icon={Building2}
        eyebrow="Hubs · Reference data"
        title="Police Stations & Prisons"
        description="Shared national reference datasets. Courts are maintained in the editable Courts Hub so matters always use one controlled register."
        meta={[`${counts['police-station'] + counts.prison} institutions on file`]}
        actions={<Link href="/admin/hubs" className="btn btn-ghost text-sm">All Hubs</Link>}
      />

      <JusticeSearch />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        {types.map(type => {
          const zone = JUSTICE_ZONES[type]
          const Icon = zone.icon
          const label = INSTITUTION_LABELS[type]
          const meta = JusticeDataService.getMeta(type)
          return (
            <Link
              key={type}
              href={label.href}
              className="card p-5 border-l-[3px] hover:shadow-[var(--shadow-md)] transition-shadow"
              style={{ borderLeftColor: zone.hex }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[0.66rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">
                  {label.plural}
                </span>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: zone.hex }} />
              </div>
              <div className="font-display text-3xl font-semibold mt-2 tabular-nums leading-none" style={{ color: zone.hex }}>
                {counts[type]}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-3 line-clamp-2">
                {meta?.source}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Validation runs when the datasets first load. Surfacing the result
          here is the only way a data problem becomes visible to the people
          who can fix the source file. */}
      {issues.length > 0 && (
        <div className="card p-5 mt-6 border-l-[3px]" style={{ borderLeftColor: 'var(--status-danger)' }}>
          <h2 className="font-display font-semibold text-[var(--color-text-primary)]">
            {issues.length} dataset {issues.length === 1 ? 'issue' : 'issues'}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-xs text-[var(--color-text-secondary)]">
            {issues.slice(0, 20).map((i, n) => (
              <li key={n}>
                <span className="font-mono text-[var(--color-text-muted)]">{i.dataset}</span>
                {i.id ? <span className="font-mono text-[var(--color-text-muted)]"> {i.id}</span> : null}
                {': '}{i.problem}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
