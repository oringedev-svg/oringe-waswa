// ============================================================
// SERVICE OF PROCESS
// ============================================================
// The response deadline depends entirely on where the recipient is: within
// town, outside town, or outside the country. These day-counts are the
// firm's own rule, kept in one place so they're easy to revisit without
// touching every call site. No cron/reminder job exists anywhere in this
// codebase, overdue state is a derived flag computed on render, the same
// convention already used for matter task due dates and account
// intervention flags.

export interface ServiceLocationTier {
  key: 'within_town' | 'outside_town' | 'outside_country'
  label: string
  days: number
}

export const SERVICE_LOCATION_TIERS: ServiceLocationTier[] = [
  { key: 'within_town', label: 'Within Town', days: 7 },
  { key: 'outside_town', label: 'Outside Town', days: 14 },
  { key: 'outside_country', label: 'Outside the Country', days: 21 },
]

export function locationTierMeta(key: string | null | undefined): ServiceLocationTier {
  return SERVICE_LOCATION_TIERS.find((t) => t.key === key) || SERVICE_LOCATION_TIERS[0]
}

/** servedAt is a 'YYYY-MM-DD' date string. Returns a 'YYYY-MM-DD' due date. */
export function responseDueDate(servedAt: string, tier: string): string {
  const days = locationTierMeta(tier).days
  const date = new Date(servedAt + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Whole days remaining until dueDate, negative once overdue. */
export function daysRemaining(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}
