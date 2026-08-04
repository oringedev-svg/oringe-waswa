// public_holidays stores RULES, not dates: a fixed month/day, an
// Easter-relative offset, or "whenever the Gazette says" for the lunar and
// declared ones. A calendar needs actual dates, so this resolves what can
// be resolved for a given year and is honest about the rest.
//
// Gazette/lunar holidays deliberately produce nothing here. Guessing a date
// for Idd-ul-Fitr would be worse than omitting it, and the schema already
// has the right answer for that case: public_holiday_overrides carries the
// declared date once it's known, which the caller layers on top.

export interface ResolvedHoliday {
  date: string // YYYY-MM-DD
  name: string
  isNonWorkingDay: boolean
}

interface HolidayRow {
  name: string
  calculation_rule: string
  month: number | null
  day: number | null
  is_non_working_day: boolean
  is_active?: boolean
}

/** Western (Gregorian) Easter Sunday -- anonymous Gregorian algorithm. */
function westernEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000)
}

/**
 * Resolve every holiday that has a knowable date in `year`.
 * Rules this can't resolve (GAZETTE_DECLARATION and anything unrecognised)
 * are skipped rather than approximated.
 */
export function resolveHolidaysForYear(rows: HolidayRow[], year: number): ResolvedHoliday[] {
  const out: ResolvedHoliday[] = []
  const easter = westernEaster(year)

  for (const row of rows) {
    if (row.is_active === false) continue
    const rule = (row.calculation_rule || '').toUpperCase()
    let date: Date | null = null

    if (rule === 'FIXED_DATE' && row.month && row.day) {
      date = new Date(Date.UTC(year, row.month - 1, row.day))
    } else if (rule === 'WESTERN_EASTER') {
      date = easter
    } else if (rule === 'WESTERN_EASTER_MINUS_2') {
      date = shiftDays(easter, -2) // Good Friday
    } else if (rule === 'WESTERN_EASTER_PLUS_1') {
      date = shiftDays(easter, 1) // Easter Monday
    }

    if (date) {
      out.push({ date: iso(date), name: row.name, isNonWorkingDay: row.is_non_working_day })
    }
  }

  return out
}
