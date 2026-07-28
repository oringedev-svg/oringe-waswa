import { createAdminClient } from '@/lib/supabase'
import { MATTER_TYPE_TO_COURT_CATEGORY } from '@/lib/courtRouting'

// ============================================================
// COST INTELLIGENCE ENGINE, calculation dispatcher
// ============================================================
// This file never knows what the Advocates Remuneration Order is. It only
// knows how to execute a calculation strategy given a rule + bands. The
// legal content (which rule applies, what its bands are) lives entirely in
// the database (migration 019), imported via src/lib/instrumentImport.ts.

export type CalculationType =
  | 'FIXED' | 'FLAT_PERCENTAGE' | 'BANDED_PERCENTAGE' | 'HOURLY'
  | 'PER_PAGE' | 'PER_ITEM' | 'PER_ATTENDANCE' | 'PER_DOCUMENT' | 'PER_HEARING' | 'DISCRETIONARY'

export const CALCULATION_TYPES: CalculationType[] = [
  'FIXED', 'FLAT_PERCENTAGE', 'BANDED_PERCENTAGE', 'HOURLY',
  'PER_PAGE', 'PER_ITEM', 'PER_ATTENDANCE', 'PER_DOCUMENT', 'PER_HEARING', 'DISCRETIONARY',
]

export interface FeeRuleBand {
  id?: string
  from_value: number
  to_value: number | null
  rate: number | null
  flat_amount: number | null
  sequence: number
}

export interface FeeRule {
  id: string
  schedule_id: string
  paragraph: string | null
  name: string
  calculation_type: CalculationType
  band_mode: 'summed' | 'step_marginal' | null
  minimum: number | null
  maximum: number | null
  fixed_amount: number | null
  unit_rate: number | null
  currency: string
  priority: number
}

export interface FeeRuleCondition {
  id?: string
  rule_id?: string
  field: string
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'IN' | 'NOT IN'
  value: string
}

export interface CalcInput {
  claimValue?: number | null
  units?: number | null
  hours?: number | null
}

export interface CalcResult {
  amount: number
  steps: string[]
}

const UNIT_LABELS: Partial<Record<CalculationType, string>> = {
  PER_PAGE: 'pages',
  PER_ITEM: 'items',
  PER_ATTENDANCE: 'attendances',
  PER_DOCUMENT: 'documents',
  PER_HEARING: 'hearings',
}

function clamp(rule: FeeRule, amount: number, steps: string[]): number {
  let result = amount
  if (rule.minimum != null && result < rule.minimum) {
    steps.push(`Minimum fee of ${rule.currency} ${rule.minimum.toLocaleString()} applies (calculated ${rule.currency} ${amount.toLocaleString()})`)
    result = rule.minimum
  }
  if (rule.maximum != null && result > rule.maximum) {
    steps.push(`Maximum fee of ${rule.currency} ${rule.maximum.toLocaleString()} applies (calculated ${rule.currency} ${result.toLocaleString()})`)
    result = rule.maximum
  }
  return result
}

// True banded/PAYE-style: each band is taxed separately and summed.
function calculateBandedSummed(bands: FeeRuleBand[], claimValue: number, steps: string[]): number {
  let total = 0
  for (const band of [...bands].sort((a, b) => a.sequence - b.sequence)) {
    if (claimValue <= band.from_value) continue
    const upper = band.to_value != null ? Math.min(claimValue, band.to_value) : claimValue
    const portion = upper - band.from_value
    if (portion <= 0) continue
    const rate = band.rate || 0
    const bandAmount = portion * rate
    total += bandAmount
    steps.push(`${portion.toLocaleString()} at ${(rate * 100).toFixed(2)}% = ${bandAmount.toLocaleString()}`)
  }
  return total
}

// Step schedule with an optional marginal rate above the band's start,
// each band's flat_amount is pre-resolved (the base for that band), so this
// is a single lookup, never a chain through earlier bands.
function calculateBandedStepMarginal(bands: FeeRuleBand[], claimValue: number, steps: string[]): number {
  const sorted = [...bands].sort((a, b) => a.sequence - b.sequence)
  const band =
    sorted.find((b) => claimValue > b.from_value && (b.to_value == null || claimValue <= b.to_value)) ||
    sorted.find((b) => claimValue <= b.from_value) ||
    sorted[sorted.length - 1]
  if (!band) return 0

  const base = band.flat_amount || 0
  if (!band.rate) {
    steps.push(`Flat fee of ${base.toLocaleString()} applies for this band`)
    return base
  }
  const excess = claimValue - band.from_value
  const marginal = excess * band.rate
  steps.push(`Base ${base.toLocaleString()} plus ${(band.rate * 100).toFixed(2)}% of ${excess.toLocaleString()} = ${(base + marginal).toLocaleString()}`)
  return base + marginal
}

export function calculateFee(rule: FeeRule, bands: FeeRuleBand[], input: CalcInput): CalcResult {
  const steps: string[] = []
  let amount = 0

  switch (rule.calculation_type) {
    case 'FIXED':
      amount = rule.fixed_amount || 0
      steps.push(`Fixed fee of ${rule.currency} ${amount.toLocaleString()}`)
      break

    case 'FLAT_PERCENTAGE': {
      const claimValue = input.claimValue || 0
      const rate = bands[0]?.rate || 0
      amount = claimValue * rate
      steps.push(`${(rate * 100).toFixed(2)}% of ${claimValue.toLocaleString()} = ${amount.toLocaleString()}`)
      break
    }

    case 'BANDED_PERCENTAGE': {
      const claimValue = input.claimValue || 0
      amount = rule.band_mode === 'summed'
        ? calculateBandedSummed(bands, claimValue, steps)
        : calculateBandedStepMarginal(bands, claimValue, steps)
      break
    }

    case 'HOURLY': {
      const hours = input.hours || 0
      const rate = rule.unit_rate || 0
      amount = hours * rate
      steps.push(`${hours} hours × ${rule.currency} ${rate.toLocaleString()}/hr = ${amount.toLocaleString()}`)
      break
    }

    case 'PER_PAGE':
    case 'PER_ITEM':
    case 'PER_ATTENDANCE':
    case 'PER_DOCUMENT':
    case 'PER_HEARING': {
      // Structurally identical (count x rate), kept as distinct
      // calculation_type values only so explanations read correctly.
      const units = input.units || 0
      const rate = rule.unit_rate || 0
      amount = units * rate
      steps.push(`${units} ${UNIT_LABELS[rule.calculation_type]} × ${rule.currency} ${rate.toLocaleString()} = ${amount.toLocaleString()}`)
      break
    }

    case 'DISCRETIONARY':
      amount = rule.minimum || 0
      steps.push("Subject to the taxing officer's discretion (complexity, importance, value, time, novelty), not computed. Minimum/base shown.")
      break
  }

  const clamped = clamp(rule, amount, steps)
  return { amount: Math.round(clamped * 100) / 100, steps }
}

// ============================================================
// CONDITION MATCHING
// ============================================================

export interface MatterForCosting {
  type: string | null
  claim_value: number | null
  county: string | null
}

/** Maps a condition's field name to a value resolved off the matter. */
export function resolveField(matter: MatterForCosting, field: string): string | number | null {
  switch (field) {
    case 'matterType': return matter.type
    case 'court': return matter.type ? MATTER_TYPE_TO_COURT_CATEGORY[matter.type] ?? null : null
    case 'claimValue': return matter.claim_value
    case 'county': return matter.county
    default: return null
  }
}

export function evaluateCondition(condition: FeeRuleCondition, matter: MatterForCosting): boolean {
  const resolved = resolveField(matter, condition.field)
  if (resolved === null || resolved === undefined) return false
  switch (condition.operator) {
    case '=': return String(resolved) === condition.value
    case '!=': return String(resolved) !== condition.value
    case '>': return Number(resolved) > Number(condition.value)
    case '>=': return Number(resolved) >= Number(condition.value)
    case '<': return Number(resolved) < Number(condition.value)
    case '<=': return Number(resolved) <= Number(condition.value)
    case 'IN': return condition.value.split(',').map((v) => v.trim()).includes(String(resolved))
    case 'NOT IN': return !condition.value.split(',').map((v) => v.trim()).includes(String(resolved))
    default: return false
  }
}

export function evaluateConditions(conditions: FeeRuleCondition[], matter: MatterForCosting): boolean {
  return conditions.every((c) => evaluateCondition(c, matter))
}

// ============================================================
// RULE RESOLUTION (server-side only)
// ============================================================

export interface ResolvedFee {
  rule: FeeRule
  schedule: { number: string; title: string }
  instrument: { name: string; version: string }
  explanation: { plain_language: string; legal_reference: string | null } | null
  result: CalcResult
}

interface RawFeeRule extends FeeRule {
  schedule: { number: string; title: string; instrument: { name: string; version: string; status: string } } | null
  bands: FeeRuleBand[] | null
  conditions: FeeRuleCondition[] | null
  explanations: { plain_language: string; legal_reference: string | null }[] | null
}

/** Given a matter, finds every fee rule from an ACTIVE instrument whose
 * conditions match, and computes each one. This is what the Cost Estimate
 * card's suggestion list is built from. */
export async function resolveApplicableFees(matter: MatterForCosting): Promise<ResolvedFee[]> {
  const supabase = createAdminClient()
  const { data: rules, error } = await supabase
    .from('fee_rules')
    .select('*, schedule:fee_schedules(number, title, instrument:legal_instruments(name, version, status)), bands:fee_rule_bands(*), conditions:fee_rule_conditions(*), explanations:fee_rule_explanations(*)')
  if (error || !rules) return []

  const resolved: ResolvedFee[] = []
  for (const rule of rules as unknown as RawFeeRule[]) {
    if (!rule.schedule || rule.schedule.instrument.status !== 'active') continue
    const conditions = rule.conditions || []
    if (conditions.length > 0 && !evaluateConditions(conditions, matter)) continue
    const result = calculateFee(rule, rule.bands || [], { claimValue: matter.claim_value })
    resolved.push({
      rule,
      schedule: { number: rule.schedule.number, title: rule.schedule.title },
      instrument: { name: rule.schedule.instrument.name, version: rule.schedule.instrument.version },
      explanation: (rule.explanations || [])[0] || null,
      result,
    })
  }
  return resolved.sort((a, b) => a.rule.priority - b.rule.priority)
}
