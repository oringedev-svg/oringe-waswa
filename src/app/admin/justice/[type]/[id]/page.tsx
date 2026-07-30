import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JusticeDataService } from '@/lib/justice/service'
import { INSTITUTION_LABELS, type Institution, type InstitutionType } from '@/lib/justice/types'
import { JUSTICE_ZONES } from '@/lib/justice/zones'
import { PageHeader } from '@/components/admin/ui'

const SLUG_TO_TYPE: Record<string, InstitutionType> = {
  courts: 'court',
  'police-stations': 'police-station',
  prisons: 'prison',
}

// Keys already rendered as the record's identity, or that are noise on a
// detail page. Everything else in the JSON is shown generically, so a new
// column in a source file appears here without a code change.
const HANDLED = new Set([
  'id', 'name', 'category', 'subCategory', 'county', 'location', 'phone',
  'email', 'website', 'services', 'institutionType', 'latitude', 'longitude',
])

function humanise(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .replace(/\bCaw\b/, 'CAW')
    .trim()
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.62rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)] mt-1 break-words">{children}</dd>
    </div>
  )
}

const NOT_STATED = <span className="text-[var(--color-text-muted)] opacity-60">Not stated in the source</span>

export default function InstitutionDetailPage({ params }: { params: { type: string; id: string } }) {
  const type = SLUG_TO_TYPE[params.type]
  if (!type) notFound()

  const record = JusticeDataService.getById(params.id)
  if (!record || record.institutionType !== type) notFound()

  const label = INSTITUTION_LABELS[type]
  const zone = JUSTICE_ZONES[type]
  const judges = type === 'court' ? JusticeDataService.getJudgesForCourt(record.id) : []

  const extras = Object.entries(record as unknown as Record<string, unknown>)
    .filter(([k, v]) => !HANDLED.has(k) && v !== null && v !== undefined && v !== '')

  return (
    <div>
      <PageHeader
        eyebrow={`${label.singular}${record.subCategory ? ` · ${record.subCategory}` : ''}`}
        title={record.name}
        meta={[record.county, record.location].filter(Boolean) as string[]}
        actions={<Link href={label.href} className="btn btn-outline text-sm">Back to {label.plural}</Link>}
      />

      <div className="card p-6 border-l-[3px] mb-4" style={{ borderLeftColor: zone.hex }}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
          <Field label="County">{record.county || NOT_STATED}</Field>
          <Field label="Location">{record.location || NOT_STATED}</Field>
          <Field label="Class">{record.subCategory || NOT_STATED}</Field>
          <Field label="Phone">
            {record.phone ? <a href={`tel:${record.phone}`} className="font-mono hover:underline">{record.phone}</a> : NOT_STATED}
          </Field>
          <Field label="Email">
            {record.email ? <a href={`mailto:${record.email}`} className="hover:underline break-all">{record.email}</a> : NOT_STATED}
          </Field>
          <Field label="Website">
            {record.website
              ? <a href={record.website} target="_blank" rel="noreferrer" className="hover:underline break-all">{record.website}</a>
              : NOT_STATED}
          </Field>
        </dl>

        {record.services.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
            <div className="font-mono text-[0.62rem] tracking-[0.12em] uppercase text-[var(--color-text-muted)] mb-2">Services</div>
            <div className="flex flex-wrap gap-1.5">
              {record.services.map(s => (
                <span key={s} className="text-xs px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Judges are resolved by courtId, never by matching court names. */}
      {type === 'court' && (
        <div className="card p-6 mb-4">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)]">
            Bench {judges.length > 0 ? `(${judges.length})` : ''}
          </h2>
          {judges.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              No bench roster on file for this court. The source supplies judges for the Supreme Court only.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-border)]">
              {judges.map(j => (
                <li key={j.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{j.name}</div>
                  {j.designation && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{j.designation}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {extras.length > 0 && (
        <div className="card p-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Additional fields</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
            {extras.map(([k, v]) => (
              <Field key={k} label={humanise(k)}>
                {typeof v === 'number' ? v.toLocaleString() : String(v)}
              </Field>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
