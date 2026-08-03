import { notFound, redirect } from 'next/navigation'
import { JusticeDataService } from '@/lib/justice/service'
import { INSTITUTION_LABELS, type InstitutionType } from '@/lib/justice/types'
import { JUSTICE_ZONES } from '@/lib/justice/zones'
import InstitutionList from './InstitutionList'

// One route serves every register. Adding tribunals.json means registering
// the dataset in service.ts and adding a label; no new route file, no
// per-institution branching anywhere in the UI.
const SLUG_TO_TYPE: Record<string, InstitutionType> = {
  courts: 'court',
  'police-stations': 'police-station',
  prisons: 'prison',
}

export function generateStaticParams() {
  return Object.keys(SLUG_TO_TYPE).map(type => ({ type }))
}

export default function InstitutionListPage({ params }: { params: { type: string } }) {
  const type = SLUG_TO_TYPE[params.type]
  if (!type) notFound()
  if (type === 'court') redirect('/admin/courts')

  const label = INSTITUTION_LABELS[type]
  const meta = JusticeDataService.getMeta(type)

  return (
    <InstitutionList
      type={type}
      slug={params.type}
      title={label.plural}
      zoneHex={JUSTICE_ZONES[type].hex}
      rows={JusticeDataService.getByType(type)}
      counties={JusticeDataService.facetValues(type, 'county')}
      subCategories={JusticeDataService.facetValues(type, 'subCategory')}
      source={meta?.source ?? ''}
      note={meta?.note}
    />
  )
}
