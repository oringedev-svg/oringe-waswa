import courtsRaw from '@/data/justice/courts.json'
import policeRaw from '@/data/justice/police-stations.json'
import prisonsRaw from '@/data/justice/prisons.json'
import judgesRaw from '@/data/justice/judges.json'
import type {
  Institution, InstitutionType, Judge, Prison, DatasetMeta, ValidationIssue, SearchResult,
} from './types'

// Every institution the app knows about comes from here. Nothing is
// hardcoded at a call site, and adding a dataset means adding one entry to
// DATASETS below plus its JSON file.
//
// The JSON is imported rather than read from disk so it is bundled once at
// build time and shared across requests, which is also what satisfies the
// "load once, cache in memory" requirement without a file watcher.

interface DatasetConfig {
  type: InstitutionType
  /** Key in the JSON file holding the record array. */
  rows: unknown[]
  meta: DatasetMeta
}

const DATASETS: DatasetConfig[] = [
  {
    type: 'court',
    rows: courtsRaw.courts,
    meta: { source: courtsRaw.source, note: courtsRaw.note, schemaVersion: courtsRaw.schemaVersion, count: courtsRaw.count },
  },
  {
    type: 'police-station',
    rows: policeRaw.stations,
    meta: { source: policeRaw.source, note: policeRaw.note, schemaVersion: policeRaw.schemaVersion, count: policeRaw.count },
  },
  {
    type: 'prison',
    rows: prisonsRaw.prisons,
    meta: { source: prisonsRaw.source, note: prisonsRaw.note, schemaVersion: prisonsRaw.schemaVersion, count: prisonsRaw.count },
  },
]

function normalise(row: Record<string, unknown>, type: InstitutionType): Institution {
  return {
    // Dataset-specific keys ride along untouched, so a new column in a
    // source file reaches the detail page without a code change. This
    // spread must come first: the normalised fields below are the
    // guaranteed contract and have to win over whatever the raw row holds.
    ...row,
    id: String(row.id),
    name: String(row.name ?? '').trim(),
    category: String(row.category ?? ''),
    subCategory: (row.subCategory as string) ?? null,
    county: (row.county as string) ?? null,
    subCounty: (row.subCounty as string) ?? null,
    location: (row.location as string) ?? null,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    services: Array.isArray(row.services) ? (row.services as string[]) : [],
    institutionType: type,
  } as unknown as Institution
}

interface Cache {
  byType: Record<InstitutionType, Institution[]>
  byId: Map<string, Institution>
  judgesByCourt: Map<string, Judge[]>
  judges: Judge[]
  meta: Record<InstitutionType, DatasetMeta>
  issues: ValidationIssue[]
}

let cache: Cache | null = null

// Validation runs once, on first access. A dataset with a fatal problem
// (duplicate ids, or records with no id or no name) is dropped rather than
// half-loaded, so a broken file can never silently serve partial results.
function validate(type: InstitutionType, rows: Institution[]): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []
  const seen = new Set<string>()

  for (const r of rows) {
    if (!r.id) { issues.push({ dataset: type, problem: 'record with no id' }); continue }
    if (seen.has(r.id)) issues.push({ dataset: type, id: r.id, problem: 'duplicate id' })
    seen.add(r.id)
    if (!r.name) issues.push({ dataset: type, id: r.id, problem: 'empty name' })
  }

  const fatal = issues.some(i => i.problem === 'duplicate id' || i.problem === 'record with no id' || i.problem === 'empty name')
  return { ok: !fatal, issues }
}

function build(): Cache {
  const byType = {} as Record<InstitutionType, Institution[]>
  const byId = new Map<string, Institution>()
  const meta = {} as Record<InstitutionType, DatasetMeta>
  const issues: ValidationIssue[] = []

  for (const ds of DATASETS) {
    const rows = (ds.rows as Record<string, unknown>[]).map(r => normalise(r, ds.type))
    const result = validate(ds.type, rows)
    issues.push(...result.issues)
    meta[ds.type] = ds.meta

    if (!result.ok) {
      console.error(`[justice] dataset "${ds.type}" failed validation and was not loaded`, result.issues)
      byType[ds.type] = []
      continue
    }
    byType[ds.type] = rows
    for (const r of rows) byId.set(r.id, r)
  }

  // Judges are validated against courts: a judge pointing at a court that
  // does not exist is a broken relationship, not a displayable record.
  const judges: Judge[] = []
  const judgesByCourt = new Map<string, Judge[]>()
  for (const j of judgesRaw.judges as Judge[]) {
    if (!byId.has(j.courtId)) {
      issues.push({ dataset: 'judges', id: j.id, problem: `references unknown court "${j.courtId}"` })
      continue
    }
    judges.push(j)
    const list = judgesByCourt.get(j.courtId) ?? []
    list.push(j)
    judgesByCourt.set(j.courtId, list)
  }

  return { byType, byId, judges, judgesByCourt, meta, issues }
}

function store(): Cache {
  if (!cache) cache = build()
  return cache
}

export const JusticeDataService = {
  getCourts: (): Institution[] => store().byType.court ?? [],
  getPoliceStations: (): Institution[] => store().byType['police-station'] ?? [],
  getPrisons: (): Prison[] => (store().byType.prison ?? []) as Prison[],

  getByType: (type: InstitutionType): Institution[] => store().byType[type] ?? [],

  /** Primary lookup. Always resolve by id, never by name. */
  getById: (id: string): Institution | null => store().byId.get(id) ?? null,

  getJudgesForCourt: (courtId: string): Judge[] => store().judgesByCourt.get(courtId) ?? [],
  getAllJudges: (): Judge[] => store().judges,

  getMeta: (type: InstitutionType): DatasetMeta => store().meta[type],
  getIssues: (): ValidationIssue[] => store().issues,

  getCounts: (): Record<InstitutionType, number> => {
    const s = store()
    return {
      court: s.byType.court?.length ?? 0,
      'police-station': s.byType['police-station']?.length ?? 0,
      prison: s.byType.prison?.length ?? 0,
    }
  },

  /**
   * One search across every registered dataset. Ranks exact name matches
   * above prefix matches above substring matches, then falls back to
   * county and location so "Milimani" and "Nairobi" both work.
   */
  search(query: string, opts?: { types?: InstitutionType[]; limit?: number }): SearchResult[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const types = opts?.types ?? (['court', 'police-station', 'prison'] as InstitutionType[])
    const limit = opts?.limit ?? 50
    const out: SearchResult[] = []

    for (const type of types) {
      for (const inst of store().byType[type] ?? []) {
        const name = inst.name.toLowerCase()
        let rank = -1
        if (name === q) rank = 0
        else if (name.startsWith(q)) rank = 1
        else if (name.includes(q)) rank = 2
        else if ((inst.county ?? '').toLowerCase().includes(q)) rank = 3
        else if ((inst.location ?? '').toLowerCase().includes(q)) rank = 4
        else if ((inst.subCategory ?? '').toLowerCase().includes(q)) rank = 5
        if (rank >= 0) out.push({ institution: inst, rank })
      }
    }

    return out
      .sort((a, b) => a.rank - b.rank || a.institution.name.localeCompare(b.institution.name))
      .slice(0, limit)
  },

  /** Filter one dataset. Any omitted facet is ignored. */
  filter(
    type: InstitutionType,
    facets: { county?: string; subCategory?: string; query?: string },
  ): Institution[] {
    const q = facets.query?.trim().toLowerCase()
    return (store().byType[type] ?? []).filter(inst => {
      if (facets.county && inst.county !== facets.county) return false
      if (facets.subCategory && inst.subCategory !== facets.subCategory) return false
      if (!q) return true
      return (
        inst.name.toLowerCase().includes(q) ||
        (inst.county ?? '').toLowerCase().includes(q) ||
        (inst.location ?? '').toLowerCase().includes(q)
      )
    })
  },

  /** Distinct values for a facet, for building filter dropdowns. */
  facetValues(type: InstitutionType, key: 'county' | 'subCategory'): string[] {
    const set = new Set<string>()
    for (const inst of store().byType[type] ?? []) {
      const v = inst[key]
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  },
}
