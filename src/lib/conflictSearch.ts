import { createAdminClient } from '@/lib/supabase'

// ============================================================
// CONFLICT SEARCH
// ============================================================
// The actual name/company matching logic behind a conflict check, shared
// between the matter/submission-bound check (which records a
// conflict_checks row and can auto-advance the pipeline) and the standalone
// pre-intake tool (which just searches and shows results, nothing to link
// to yet). Same firm-wide records, same algorithm, either way.

export interface ConflictMatch {
  match_type: string
  name: string
  detail: string
  risk: 'low' | 'medium' | 'high'
  /** Which searched entity produced this hit, set on multi-target searches. */
  target?: string
  target_role?: string
}

/**
 * The kinds of party a conflict search can be run against. A real check covers
 * more than the prospective client: the other side, its directors, the estate
 * or trust involved, and the advocates already on the record all have to be
 * cleared too.
 */
export const CONFLICT_TARGET_ROLES = [
  'client', 'opposing_party', 'company', 'director', 'witness', 'estate', 'trust', 'advocate',
] as const

export type ConflictTargetRole = (typeof CONFLICT_TARGET_ROLES)[number]

export interface ConflictTarget {
  name: string
  role?: ConflictTargetRole | string
}

export const CONFLICT_ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  opposing_party: 'Opposing party',
  company: 'Company',
  director: 'Director',
  witness: 'Witness',
  estate: 'Estate',
  trust: 'Trust',
  advocate: 'Advocate',
}

const RISK_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }

export async function runConflictSearch(
  query: string,
  opts?: { excludeMatterId?: string; excludeSubmissionId?: string }
): Promise<{ results: ConflictMatch[]; highestRisk: string }> {
  const supabase = createAdminClient()
  const like = `%${query}%`
  const results: ConflictMatch[] = []

  // Existing/related matters, same client, opposing party, or case number.
  let matterQuery = supabase
    .from('legal_matters')
    .select('id, matter_number, client_name, opposing_party, case_number, status')
    .or(`client_name.ilike.${like},opposing_party.ilike.${like},case_number.ilike.${like}`)
  if (opts?.excludeMatterId) matterQuery = matterQuery.neq('id', opts.excludeMatterId)
  const { data: matterMatches } = await matterQuery

  for (const m of matterMatches || []) {
    const isOpposing = m.opposing_party?.toLowerCase().includes(query.toLowerCase())
    results.push({
      match_type: 'Matter Record',
      name: m.client_name,
      detail: `${m.matter_number} · ${m.status}${isOpposing ? ' (as opposing party)' : ''}`,
      risk: isOpposing ? 'high' : 'medium',
    })
  }

  // Prior/prospective clients from public intake submissions, excluding
  // the submission this check is being run from (it would trivially match
  // its own submitter's name).
  let submissionQuery = supabase
    .from('submissions')
    .select('id, submitter_name, type, created_at')
    .ilike('submitter_name', like)
  if (opts?.excludeSubmissionId) submissionQuery = submissionQuery.neq('id', opts.excludeSubmissionId)
  const { data: submissionMatches } = await submissionQuery

  for (const s of submissionMatches || []) {
    results.push({
      match_type: 'Prospective Client / Intake',
      name: s.submitter_name,
      detail: `${s.type} submission · ${new Date(s.created_at).toLocaleDateString()}`,
      risk: 'low',
    })
  }

  // People already linked to any matter (staff, clients, other parties),
  // find matching profiles first, then look up their matter links, to
  // avoid relying on filtering through a nested/embedded PostgREST resource.
  const { data: matchingProfiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', like)

  if (matchingProfiles && matchingProfiles.length > 0) {
    const { data: peopleMatches } = await supabase
      .from('matter_people')
      .select('role, profile_id, matter:legal_matters(matter_number, client_name)')
      .in('profile_id', matchingProfiles.map((p) => p.id))

    const nameById = new Map(matchingProfiles.map((p) => [p.id, p.full_name]))
    for (const p of (peopleMatches || []) as unknown as { role: string; profile_id: string; matter: { matter_number: string; client_name: string } | null }[]) {
      results.push({
        match_type: 'Existing / Former Client',
        name: nameById.get(p.profile_id) || 'Unknown',
        detail: `${p.role} on ${p.matter?.matter_number || 'a matter'}, ${p.matter?.client_name || ''}`,
        risk: 'medium',
      })
    }
  }

  const highestRisk = results.reduce((acc, r) => (RISK_RANK[r.risk] > RISK_RANK[acc] ? r.risk : acc), 'none' as string)
  return { results, highestRisk }
}

/**
 * Run one check across several parties at once, which is what a real conflict
 * search is: the client, the other side, its directors and anyone else with an
 * interest, cleared together and recorded as a single decision. Each hit is
 * tagged with the party that produced it so the results stay attributable.
 *
 * Returns a `summary` suitable for the conflict_checks.search_query column,
 * which predates multi-target search and stores a single human-readable string.
 */
export async function runMultiConflictSearch(
  targets: ConflictTarget[],
  opts?: { excludeMatterId?: string; excludeSubmissionId?: string },
): Promise<{ results: ConflictMatch[]; highestRisk: string; summary: string }> {
  const cleaned = targets
    .map(t => ({ name: t.name.trim(), role: t.role }))
    .filter(t => t.name.length > 0)

  // De-duplicate by name+role so the same party listed twice isn't searched
  // twice and doesn't double up in the results.
  const seen = new Set<string>()
  const unique = cleaned.filter(t => {
    const key = `${t.name.toLowerCase()}::${t.role || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const perTarget = await Promise.all(
    unique.map(async t => {
      const { results } = await runConflictSearch(t.name, opts)
      return results.map(r => ({ ...r, target: t.name, target_role: t.role }))
    }),
  )

  const results = perTarget.flat()
  const highestRisk = results.reduce((acc, r) => (RISK_RANK[r.risk] > RISK_RANK[acc] ? r.risk : acc), 'none' as string)
  const summary = unique
    .map(t => (t.role ? `${t.name} (${CONFLICT_ROLE_LABELS[t.role] || t.role})` : t.name))
    .join(', ')

  return { results, highestRisk, summary }
}
