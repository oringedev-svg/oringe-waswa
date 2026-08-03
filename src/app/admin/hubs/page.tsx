'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Building2, CalendarDays, Landmark, Plus, RefreshCw, Scale, Shield, Trash2 } from 'lucide-react'
import { PageHeader, EmptyState, LoadingState, StatusPill } from '@/components/admin/ui'

type Holiday = { id: string; name: string; calculation_rule: string; faith_scope: string | null; is_non_working_day: boolean; notes: string | null }

const REFERENCE_HUBS = [
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

export function HolidayHub() {
  const [holidays, setHolidays] = useState<Holiday[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [rule, setRule] = useState('GAZETTE_DECLARATION'); const [saving, setSaving] = useState(false)
  const load = () => { setLoading(true); setError(null); fetch('/api/reference/holidays', { cache: 'no-store' }).then(async r => ({ ok: r.ok, data: await r.json() })).then(r => { if (!r.ok) setError(r.data.error || 'Could not load holiday data'); else setHolidays(r.data.holidays || []) }).catch(() => setError('Could not load holiday data')).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const addHoliday = async () => { if (!name.trim()) return; setSaving(true); const res = await fetch('/api/reference/holidays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), holiday_type: 'PUBLIC', calculation_rule: rule, source_url: 'https://new.kenyalaw.org/akn/ke/act/1912/21' }) }); setSaving(false); if (res.ok) { setAdding(false); setName(''); load() } else setError((await res.json()).error || 'Could not create holiday') }
  const deactivate = async (id: string) => { if (!confirm('Deactivate this reference record? It will remain in the audit history.')) return; const res = await fetch('/api/reference/holidays', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (res.ok) load(); else setError((await res.json()).error || 'Could not deactivate holiday') }
  return <div><PageHeader icon={CalendarDays} eyebrow="Hubs · Reference data" title="Holidays" description="Maintain the controlled holiday and working-day rules used by scheduling and deadline calculations." meta={[`${holidays.length} Kenya holiday records`]} actions={<><button className="btn btn-ghost gap-2" onClick={load}><RefreshCw className="w-4 h-4" /> Refresh</button><button className="btn btn-primary gap-2" onClick={() => setAdding(v => !v)}><Plus className="w-4 h-4" /> Add holiday</button></>} />{adding && <div className="card p-4 mb-5 grid gap-3 md:grid-cols-[1fr_220px_auto]"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Holiday name" /><select className="input" value={rule} onChange={e => setRule(e.target.value)}><option value="FIXED_DATE">Fixed date</option><option value="GAZETTE_DECLARATION">Gazette declaration</option><option value="WESTERN_EASTER">Western Easter</option></select><button className="btn btn-primary" disabled={saving || !name.trim()} onClick={addHoliday}>{saving ? 'Saving…' : 'Save'}</button></div>}{loading ? <LoadingState label="Loading holiday data" /> : error ? <EmptyState icon={CalendarDays} title="Holiday data unavailable" description={error} action={<button className="btn btn-primary" onClick={load}>Try again</button>} /> : <div className="card overflow-hidden"><div className="px-5 py-4 border-b border-[var(--color-border)]"><h2 className="font-semibold text-[var(--color-text-primary)]">Kenya public holidays</h2><p className="text-sm text-[var(--color-text-muted)] mt-1">Controlled list for calendar and deadline calculations. Lunar and Gazette-declared dates require an annual override.</p></div><div className="divide-y divide-[var(--color-border)]">{holidays.map(h => <div key={h.id} className="px-5 py-3 flex items-center gap-3"><CalendarDays className="w-4 h-4 text-[var(--color-brand)]" /><div className="min-w-0 flex-1"><div className="font-medium text-sm text-[var(--color-text-primary)]">{h.name}</div><div className="text-xs text-[var(--color-text-muted)]">{h.calculation_rule}{h.faith_scope ? ` · ${h.faith_scope}` : ''}{h.notes ? ` · ${h.notes}` : ''}</div></div><StatusPill tone={h.is_non_working_day ? 'safe' : 'review'}>{h.is_non_working_day ? 'Non-working' : 'Observance'}</StatusPill><button className="btn btn-ghost p-2 !px-2" title="Deactivate" onClick={() => deactivate(h.id)}><Trash2 className="w-4 h-4" /></button></div>)}</div></div>}</div>
}

export default function ReferenceHubsPage() {
  return <div><PageHeader icon={BookOpen} eyebrow="Shared firm-wide knowledge & reusable assets" title="Hubs" description="Choose a reference hub to create, update, retire and audit reusable firm data." /><ReferenceHubCards /></div>
}
