// One colour vocabulary for everything that can land on a calendar, so a
// court date reads as a court date wherever it appears -- the desk
// calendar, the day agenda, a matter page, a legend. Adding a surface
// should mean importing this, never picking new colours.
//
// Deliberately aligned with the tokens already in use elsewhere:
// --status-danger / --status-warning for the two things that carry real
// consequence (a missed court date, a missed deadline), and the muted
// palette from sectionColors.ts for everything informational.

export type CalendarItemKind =
  | 'court'
  | 'deadline'
  | 'meeting'
  | 'internal'
  | 'task'
  | 'holiday'
  | 'other'

export interface CalendarKindStyle {
  label: string
  /** Solid colour for dots, bars and the left rule on an agenda row. */
  hex: string
  /** Tint for chip/row backgrounds, kept faint so text stays readable. */
  tint: string
}

export const CALENDAR_KIND_STYLES: Record<CalendarItemKind, CalendarKindStyle> = {
  // Missing one of these has consequences that can't be undone the next
  // morning, so they take the two alarm colours.
  court:    { label: 'Court date',  hex: '#a3433a', tint: 'rgba(163, 67, 58, 0.12)' },
  deadline: { label: 'Deadline',    hex: '#a97d2f', tint: 'rgba(169, 125, 47, 0.14)' },
  // Everything else is informational.
  meeting:  { label: 'Meeting',     hex: '#3b6e8f', tint: 'rgba(59, 110, 143, 0.12)' },
  internal: { label: 'Internal',    hex: '#6b5580', tint: 'rgba(107, 85, 128, 0.12)' },
  task:     { label: 'Task due',    hex: '#3f7a5c', tint: 'rgba(63, 122, 92, 0.12)' },
  holiday:  { label: 'Holiday',     hex: '#5c6570', tint: 'rgba(92, 101, 112, 0.12)' },
  other:    { label: 'Other',       hex: '#5c6570', tint: 'rgba(92, 101, 112, 0.10)' },
}

/** calendar_events.type is free-ish text; anything unrecognised reads as 'other'. */
export function kindFromEventType(type: string | null | undefined): CalendarItemKind {
  switch ((type || '').toLowerCase()) {
    case 'court': return 'court'
    case 'deadline': return 'deadline'
    case 'meeting': return 'meeting'
    case 'internal': return 'internal'
    default: return 'other'
  }
}

export function styleFor(kind: CalendarItemKind): CalendarKindStyle {
  return CALENDAR_KIND_STYLES[kind] ?? CALENDAR_KIND_STYLES.other
}

/** The kinds worth showing in a legend, in the order they should read. */
export const LEGEND_ORDER: CalendarItemKind[] = ['court', 'deadline', 'meeting', 'task', 'holiday']
