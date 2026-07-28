import { createAdminClient } from '@/lib/supabase'

// Maps the existing MATTER_TYPES values (src/lib/utils.ts) onto the
// court_routing_rules.category keys seeded from the firm's own
// court-jurisdiction reference. null means the practice area doesn't map
// onto a single first-instance court in the same value-banded way (e.g.
// immigration and ADR matters), so no suggestion is shown rather than
// guessing.
export const MATTER_TYPE_TO_COURT_CATEGORY: Record<string, string | null> = {
  civil_litigation: 'civil_commercial',
  corporate: 'civil_commercial',
  property: 'land',
  employment: 'employment',
  family_law: 'family',
  criminal_defense: 'criminal_minor',
  constitutional: 'constitutional',
  intellectual_property: 'civil_commercial',
  immigration: null,
  alternative_dispute: null,
  other: null,
}

export interface CourtRoutingRule {
  id: string
  category: string
  label: string
  min_value: number | null
  max_value: number | null
  court_name: string
  registry_notes: string | null
  display_order: number
}

export interface CourtGuidance {
  category: string
  matched: CourtRoutingRule[]
}

/** Server-side only: reads court_routing_rules and returns the rule(s) that apply. */
export async function resolveCourtGuidance(matterType: string | null | undefined, claimValue: number | null | undefined): Promise<CourtGuidance | null> {
  if (!matterType) return null
  const category = MATTER_TYPE_TO_COURT_CATEGORY[matterType]
  if (!category) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('court_routing_rules')
    .select('id, category, label, min_value, max_value, court_name, registry_notes, display_order')
    .eq('category', category)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
  if (error || !data) return null

  // Value-banded categories (civil_commercial) narrow to the band the claim
  // value falls in, when a value is given; everything else has at most one
  // row per category already, or genuinely has multiple valid courts (e.g.
  // criminal, where severity rather than value decides), so show them all.
  const value = typeof claimValue === 'number' && !Number.isNaN(claimValue) ? claimValue : null
  const banded = data.filter((r) => r.min_value !== null || r.max_value !== null)
  if (value !== null && banded.length > 0) {
    const matched = data.filter((r) => (r.min_value === null || value > r.min_value) && (r.max_value === null || value <= r.max_value))
    if (matched.length > 0) return { category, matched }
  }

  return { category, matched: data }
}
