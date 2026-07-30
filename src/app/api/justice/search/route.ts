import { NextRequest, NextResponse } from 'next/server'
import { JusticeDataService } from '@/lib/justice/service'
import type { InstitutionType } from '@/lib/justice/types'

const VALID_TYPES: InstitutionType[] = ['court', 'police-station', 'prison']

// Reference data only. It is read-only, identical for every user, and
// carries nothing client-specific, so there is no per-user scoping here.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const typeParam = searchParams.get('types')

  const types = typeParam
    ? (typeParam.split(',').filter(t => VALID_TYPES.includes(t as InstitutionType)) as InstitutionType[])
    : undefined

  const results = JusticeDataService.search(q, {
    types: types?.length ? types : undefined,
    limit: 40,
  })

  return NextResponse.json({
    query: q,
    count: results.length,
    results: results.map(r => ({
      id: r.institution.id,
      name: r.institution.name,
      institutionType: r.institution.institutionType,
      subCategory: r.institution.subCategory,
      county: r.institution.county,
      location: r.institution.location,
    })),
  })
}
