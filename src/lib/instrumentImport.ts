import { CALCULATION_TYPES } from '@/lib/costEngine'

// ============================================================
// LEGAL INSTRUMENT JSON, import/validation
// ============================================================
// The generic shape every legal instrument (ARO, a court fees schedule,
// a registry fee schedule, ...) is converted into. Adding a new instrument
// is a content update through this shape, never a code change, as long as
// it uses one of the existing calculation strategies in costEngine.ts.
//
// {
//   "instrument": { "slug", "name", "authority"?, "instrument_type"?, "version", "effective_date"?, "expiry_date"?, "source_note"? },
//   "schedules": [{ "id", "number", "title", "description"? }],
//   "rules": [{ "id", "schedule", "paragraph"?, "name", "calculation_type", "band_mode"?, "minimum"?, "maximum"?, "fixed_amount"?, "unit_rate"?, "currency"? }],
//   "bands": [{ "rule", "from", "to"?, "rate"?, "flat_amount"?, "sequence" }],
//   "conditions": [{ "rule", "field", "operator", "value" }],
//   "explanations": [{ "rule", "plain_language", "legal_reference"? }]
// }
//
// "id" on schedules/rules is a LOCAL reference used only within this JSON
// document (to link bands/conditions/rules to their parent), it is not
// stored, the import route assigns real database UUIDs.

const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'IN', 'NOT IN']

export interface InstrumentJson {
  instrument: {
    slug: string
    name: string
    authority?: string
    instrument_type?: string
    version: string
    effective_date?: string
    expiry_date?: string
    source_note?: string
  }
  schedules: { id: string; number: string; title: string; description?: string }[]
  rules: {
    id: string
    schedule: string
    paragraph?: string
    name: string
    calculation_type: string
    band_mode?: string
    minimum?: number
    maximum?: number
    fixed_amount?: number
    unit_rate?: number
    currency?: string
  }[]
  bands: { rule: string; from: number; to?: number | null; rate?: number; flat_amount?: number; sequence: number }[]
  conditions: { rule: string; field: string; operator: string; value: string }[]
  explanations: { rule: string; plain_language: string; legal_reference?: string }[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateInstrumentJson(json: unknown): ValidationResult {
  const errors: string[] = []
  if (!json || typeof json !== 'object') return { valid: false, errors: ['Top-level value must be a JSON object'] }
  const j = json as Partial<InstrumentJson>

  if (!j.instrument || typeof j.instrument !== 'object') {
    errors.push('Missing "instrument"')
  } else {
    if (!j.instrument.slug) errors.push('instrument.slug is required')
    if (!j.instrument.name) errors.push('instrument.name is required')
    if (!j.instrument.version) errors.push('instrument.version is required')
  }

  const schedules = Array.isArray(j.schedules) ? j.schedules : []
  if (schedules.length === 0) errors.push('At least one schedule is required')
  const scheduleIds = new Set<string>()
  for (const s of schedules) {
    if (!s.id) { errors.push('Every schedule needs an "id" (local reference)'); continue }
    if (scheduleIds.has(s.id)) errors.push(`Duplicate schedule id "${s.id}"`)
    scheduleIds.add(s.id)
    if (!s.number) errors.push(`Schedule "${s.id}" is missing "number"`)
    if (!s.title) errors.push(`Schedule "${s.id}" is missing "title"`)
  }

  const rules = Array.isArray(j.rules) ? j.rules : []
  if (rules.length === 0) errors.push('At least one rule is required')
  const ruleIds = new Set<string>()
  const paragraphsBySchedule = new Map<string, Set<string>>()
  for (const r of rules) {
    if (!r.id) { errors.push('Every rule needs an "id" (local reference)'); continue }
    if (ruleIds.has(r.id)) errors.push(`Duplicate rule id "${r.id}"`)
    ruleIds.add(r.id)
    if (!r.schedule || !scheduleIds.has(r.schedule)) errors.push(`Rule "${r.id}" references unknown schedule "${r.schedule}"`)
    if (!r.name) errors.push(`Rule "${r.id}" is missing "name"`)
    if (!r.calculation_type || !CALCULATION_TYPES.includes(r.calculation_type as (typeof CALCULATION_TYPES)[number])) {
      errors.push(`Rule "${r.id}" has an unknown calculation_type "${r.calculation_type}" (must be one of ${CALCULATION_TYPES.join(', ')})`)
    }
    if (r.calculation_type === 'BANDED_PERCENTAGE' && r.band_mode !== 'summed' && r.band_mode !== 'step_marginal') {
      errors.push(`Rule "${r.id}" uses BANDED_PERCENTAGE and needs "band_mode" of "summed" or "step_marginal"`)
    }
    if (r.paragraph) {
      const set = paragraphsBySchedule.get(r.schedule) || new Set<string>()
      if (set.has(r.paragraph)) errors.push(`Duplicate paragraph "${r.paragraph}" within schedule "${r.schedule}"`)
      set.add(r.paragraph)
      paragraphsBySchedule.set(r.schedule, set)
    }
  }

  const bands = Array.isArray(j.bands) ? j.bands : []
  const bandsByRule = new Map<string, typeof bands>()
  for (const b of bands) {
    if (!b.rule || !ruleIds.has(b.rule)) { errors.push(`Band references unknown rule "${b.rule}"`); continue }
    if (typeof b.from !== 'number') errors.push(`A band on rule "${b.rule}" is missing a numeric "from"`)
    if (typeof b.sequence !== 'number') errors.push(`A band on rule "${b.rule}" is missing a numeric "sequence"`)
    const list = bandsByRule.get(b.rule) || []
    list.push(b)
    bandsByRule.set(b.rule, list)
  }
  // Band continuity: sorted by sequence, each band's "to" should meet the
  // next band's "from" with no gap or overlap, and only the last band may
  // be open-ended (to == null).
  for (const [ruleId, ruleBands] of Array.from(bandsByRule)) {
    const sorted = [...ruleBands].sort((a, b) => a.sequence - b.sequence)
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]
      if (current.to == null) {
        errors.push(`Rule "${ruleId}": band ${current.sequence} is open-ended but is not the last band`)
      } else if (current.to !== next.from) {
        errors.push(`Rule "${ruleId}": band ${current.sequence} ends at ${current.to} but band ${next.sequence} starts at ${next.from} (gap or overlap)`)
      }
    }
  }

  const conditions = Array.isArray(j.conditions) ? j.conditions : []
  for (const c of conditions) {
    if (!c.rule || !ruleIds.has(c.rule)) errors.push(`Condition references unknown rule "${c.rule}"`)
    if (!c.field) errors.push(`A condition on rule "${c.rule}" is missing "field"`)
    if (!OPERATORS.includes(c.operator)) errors.push(`A condition on rule "${c.rule}" has an unknown operator "${c.operator}"`)
    if (c.value === undefined || c.value === null || c.value === '') errors.push(`A condition on rule "${c.rule}" is missing "value"`)
  }

  const explanations = Array.isArray(j.explanations) ? j.explanations : []
  for (const e of explanations) {
    if (!e.rule || !ruleIds.has(e.rule)) errors.push(`Explanation references unknown rule "${e.rule}"`)
    if (!e.plain_language) errors.push(`An explanation on rule "${e.rule}" is missing "plain_language"`)
  }

  return { valid: errors.length === 0, errors }
}
