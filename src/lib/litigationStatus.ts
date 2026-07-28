// ============================================================
// LITIGATION STATUS
// ============================================================
// Where the DISPUTE has reached, which is a different axis from the matter
// stage in src/lib/matterLifecycle.ts. That one tracks the engagement
// (lead -> conflict check -> engagement letter -> retainer -> open); a
// matter can be "open" for a year and never see a courtroom.
//
// The sequence reflects Kenyan practice: most civil disputes open with a
// demand letter, negotiation or ADR is expected before filing (Article
// 159(2)(c) of the Constitution requires courts to promote alternative
// dispute resolution), and only then does a suit get filed. Several
// statuses are terminal without any court involvement at all.

export type LitigationStatus =
  | 'pre_action'
  | 'demand_letter_served'
  | 'negotiation'
  | 'adr_mediation'
  | 'arbitration'
  | 'filed_in_court'
  | 'in_court'
  | 'judgment_delivered'
  | 'appeal'
  | 'execution'
  | 'settled_out_of_court'
  | 'withdrawn'
  | 'concluded'

export interface LitigationStatusMeta {
  key: LitigationStatus
  label: string
  /** True once the matter is actually before a court, so a court must be set. */
  requiresCourt: boolean
  /** Nothing further is expected on this matter. */
  isTerminal: boolean
  description: string
  color: string
}

export const LITIGATION_STATUSES: LitigationStatusMeta[] = [
  { key: 'pre_action', label: 'Pre-Action', requiresCourt: false, isTerminal: false, color: 'gray',
    description: 'Instructions taken, advice given, no formal step yet.' },
  { key: 'demand_letter_served', label: 'Demand Letter Served', requiresCourt: false, isTerminal: false, color: 'amber',
    description: 'Statutory or contractual demand issued and served on the opposing party.' },
  { key: 'negotiation', label: 'Negotiation', requiresCourt: false, isTerminal: false, color: 'amber',
    description: 'Without-prejudice settlement talks underway.' },
  { key: 'adr_mediation', label: 'ADR / Mediation', requiresCourt: false, isTerminal: false, color: 'blue',
    description: 'Referred to mediation or another alternative process.' },
  { key: 'arbitration', label: 'Arbitration', requiresCourt: false, isTerminal: false, color: 'blue',
    description: 'Before an arbitral tribunal under the Arbitration Act.' },
  { key: 'filed_in_court', label: 'Filed in Court', requiresCourt: true, isTerminal: false, color: 'purple',
    description: 'Pleadings filed and the case number issued. Awaiting service or first mention.' },
  { key: 'in_court', label: 'In Court', requiresCourt: true, isTerminal: false, color: 'purple',
    description: 'Live before the court: mentions, hearings, interlocutory applications.' },
  { key: 'judgment_delivered', label: 'Judgment Delivered', requiresCourt: true, isTerminal: false, color: 'green',
    description: 'Court has delivered judgment or a ruling disposing of the suit.' },
  { key: 'appeal', label: 'On Appeal', requiresCourt: true, isTerminal: false, color: 'purple',
    description: 'Appeal filed against the decision of the court below.' },
  { key: 'execution', label: 'Execution', requiresCourt: true, isTerminal: false, color: 'amber',
    description: 'Enforcing a decree: warrants, garnishee, or attachment.' },
  { key: 'settled_out_of_court', label: 'Settled Out of Court', requiresCourt: false, isTerminal: true, color: 'green',
    description: 'Resolved by agreement. Record a consent if one was filed.' },
  { key: 'withdrawn', label: 'Withdrawn', requiresCourt: false, isTerminal: true, color: 'gray',
    description: 'Claim withdrawn or instructions terminated before conclusion.' },
  { key: 'concluded', label: 'Concluded', requiresCourt: false, isTerminal: true, color: 'green',
    description: 'Matter fully concluded and nothing further is outstanding.' },
]

export function litigationStatusMeta(key: string): LitigationStatusMeta {
  return (
    LITIGATION_STATUSES.find((s) => s.key === key) ?? {
      key: key as LitigationStatus,
      label: key,
      requiresCourt: false,
      isTerminal: false,
      description: '',
      color: 'gray',
    }
  )
}

export function litigationStatusLabel(key: string): string {
  return litigationStatusMeta(key).label
}

/** Whether this status means the matter is before a court and needs one set. */
export function requiresCourt(key: string): boolean {
  return litigationStatusMeta(key).requiresCourt
}

/** Court types, for grouping the register in a picker. */
export const COURT_TYPES: { key: string; label: string }[] = [
  { key: 'supreme', label: 'Supreme Court' },
  { key: 'court_of_appeal', label: 'Court of Appeal' },
  { key: 'high_court', label: 'High Court' },
  { key: 'elc', label: 'Environment and Land Court' },
  { key: 'elrc', label: 'Employment and Labour Relations Court' },
  { key: 'magistrate', label: "Magistrates' Court" },
  { key: 'kadhi', label: "Kadhis' Court" },
  { key: 'small_claims', label: 'Small Claims Court' },
  { key: 'tribunal', label: 'Tribunal' },
  { key: 'court_martial', label: 'Court Martial' },
]

export function courtTypeLabel(key: string): string {
  return COURT_TYPES.find((t) => t.key === key)?.label ?? key
}

// Registry status: whether a court entry is a main registry, a
// sub-registry, a named division within one station, or simply not
// distinguished in the source data. Most rows are 'unspecified' honestly,
// the source material did not break every court type down this far.
export const REGISTRY_TYPES: { key: string; label: string }[] = [
  { key: 'main', label: 'Main Registry' },
  { key: 'sub', label: 'Sub-Registry' },
  { key: 'division', label: 'Division' },
  { key: 'unspecified', label: 'Unspecified' },
]

export function registryTypeLabel(key: string): string {
  return REGISTRY_TYPES.find((t) => t.key === key)?.label ?? key
}
