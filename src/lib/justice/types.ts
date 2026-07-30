// The shared shape every justice institution dataset conforms to. Adding a
// new dataset (tribunals, probation offices, ADR centres) means adding a
// JSON file and one registry entry in service.ts; no consumer of this
// module needs to change.
export interface Institution {
  id: string
  name: string
  /** Dataset family: Judiciary, Police, Prison, and so on. */
  category: string
  /** Class within the family: High Court, Police Post, and so on. */
  subCategory: string | null
  county: string | null
  subCounty?: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  email: string | null
  website: string | null
  services: string[]
  /** Which registered dataset this record came from. */
  institutionType: InstitutionType
}

export type InstitutionType = 'court' | 'police-station' | 'prison'

export interface Court extends Institution {
  institutionType: 'court'
}

export interface PoliceStation extends Institution {
  institutionType: 'police-station'
}

export interface Prison extends Institution {
  institutionType: 'prison'
  /**
   * Registered voters at the facility for the 2022 General Election. This is
   * the only population figure the source carries; it is not an inmate or
   * staff count and must never be presented as one.
   */
  registeredVoters: number | null
  countyCode?: string | null
  constName?: string | null
  pollingStationCode?: string | null
}

export interface Judge {
  id: string
  name: string
  /** Foreign key onto Court.id. Never match a judge to a court by name. */
  courtId: string
  designation: string | null
  division: string | null
  appointmentDate: string | null
  status: string | null
}

export interface DatasetMeta {
  source: string
  note?: string
  schemaVersion?: string
  count: number
}

export interface ValidationIssue {
  dataset: string
  id?: string
  problem: string
}

export interface SearchResult {
  institution: Institution
  /** Lower is a better match. Used only to order results. */
  rank: number
}

/** Human labels for each dataset, for headings and result rows. */
export const INSTITUTION_LABELS: Record<InstitutionType, { singular: string; plural: string; href: string }> = {
  court: { singular: 'Court', plural: 'Courts', href: '/admin/justice/courts' },
  'police-station': { singular: 'Police Station', plural: 'Police Stations', href: '/admin/justice/police-stations' },
  prison: { singular: 'Prison', plural: 'Prisons', href: '/admin/justice/prisons' },
}
