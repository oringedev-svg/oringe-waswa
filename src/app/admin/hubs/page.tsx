'use client'

import Link from 'next/link'
import { BookOpen, Building2, CalendarDays, DollarSign, Landmark, Scale, Shield } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'

const REFERENCE_HUBS = [
  { href: '/admin/hubs/billing-references', icon: DollarSign, title: 'Billing References', description: 'Define work types, pricing and valuation for billing automation. Hub source of truth for all assignment valuations.', source: 'Firm-controlled billing taxonomy', action: 'Manage billing' },
  { href: '/admin/hubs/holidays', icon: CalendarDays, title: 'Holidays', description: 'Working-day rules and public-holiday overrides for scheduling and deadlines.', source: 'Public Holidays Act (Kenya Law)', action: 'Manage holidays' },
  { href: '/admin/courts', icon: Landmark, title: 'Courts', description: 'One controlled, editable court register used whenever a matter is filed.', source: 'Judiciary of Kenya, Kenya Law & court registries reference', action: 'Manage courts' },
  { href: '/admin/practice-areas', icon: Scale, title: 'Practice & Matter Taxonomy', description: 'Shared service lines and matter classifications used by the website, intake and matter work.', source: 'Firm-controlled reference taxonomy', action: 'Manage taxonomy' },
  { href: '/admin/justice/police-stations', icon: Shield, title: 'Police Stations', description: 'The shared national police-station reference dataset.', source: 'Public directories; verify operational details with NPS', action: 'Open police stations' },
  { href: '/admin/justice/prisons', icon: Building2, title: 'Prisons', description: 'The shared national prisons reference dataset.', source: 'IEBC 2022 registered-voter reference', action: 'Open prisons' },
]

function ReferenceHubCards() {
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
    {REFERENCE_HUBS.map(hub => <Link key={hub.href} href={hub.href} className="card p-5 hover:shadow-[var(--shadow-md)] transition-shadow group"><hub.icon className="w-5 h-5 text-[var(--color-brand)]" /><h2 className="font-semibold text-[var(--color-text-primary)] mt-4">{hub.title}</h2><p className="text-sm text-[var(--color-text-muted)] mt-1.5 min-h-10">{hub.description}</p><p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">Source: {hub.source}</p><span className="inline-block text-sm font-medium text-[var(--color-brand)] mt-4 group-hover:underline">{hub.action} →</span></Link>)}
  </div>
}

export default function ReferenceHubsPage() {
  return <div><PageHeader icon={BookOpen} eyebrow="Shared firm-wide knowledge & reusable assets" title="Hubs" description="Choose a reference hub to create, update, retire and audit reusable firm data." /><ReferenceHubCards /></div>
}
