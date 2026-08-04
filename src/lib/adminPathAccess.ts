// Which admin path a given permission unlocks, for roles that are otherwise
// kept out of /admin entirely (pupil, admin_assistant -- see middleware.ts).
//
// This is the inverse of PERMISSION_TOOLS in permissionTools.ts, which maps
// permission -> the tool card shown on someone's desk. That file imports
// lucide-react for icons, so it can't be pulled into middleware's Edge
// runtime; this is the same relationship expressed as plain strings, and the
// two must be kept in step. If a tool card exists there with no entry here,
// its link is a dead end: middleware bounces the click straight back to
// /desk. That was exactly the bug this file was written to fix.
//
// DEFAULT DENY IS THE INVARIANT. A path with no entry here stays blocked for
// restricted roles, which is what keeps this safe: 57 of 60 admin pages do no
// permission checking of their own, so anything not deliberately listed and
// mapped to a real permission must remain unreachable.

/** Path prefix -> permissions, ANY of which is enough to reach it. */
export const ADMIN_PATH_PERMISSIONS: { prefix: string; anyOf: string[] }[] = [
  { prefix: '/admin/blog', anyOf: ['publish_articles', 'approve_articles'] },
  { prefix: '/admin/team', anyOf: ['manage_lawyers'] },
  { prefix: '/admin/practice-areas', anyOf: ['manage_practice_areas'] },
  { prefix: '/admin/media', anyOf: ['manage_media'] },
  { prefix: '/admin/testimonials', anyOf: ['manage_testimonials'] },
  { prefix: '/admin/submissions', anyOf: ['manage_forms'] },
  { prefix: '/admin/awards', anyOf: ['manage_awards'] },
  { prefix: '/admin/events', anyOf: ['manage_events'] },
  { prefix: '/admin/resources', anyOf: ['manage_resources'] },
  { prefix: '/admin/matters', anyOf: ['manage_matters', 'run_conflict_check', 'log_time', 'manage_matter_costs'] },
  { prefix: '/admin/court-calendar', anyOf: ['manage_matters'] },
  { prefix: '/admin/invoices', anyOf: ['manage_billing'] },
  { prefix: '/admin/calendar', anyOf: ['manage_calendar'] },
  { prefix: '/admin/users', anyOf: ['manage_users'] },
  { prefix: '/admin/knowledge', anyOf: ['manage_legal_knowledge'] },
  { prefix: '/admin/fee-schedules', anyOf: ['manage_fee_schedules'] },
  { prefix: '/admin/organization', anyOf: ['manage_organization'] },
]

/**
 * Whether a restricted-role user holding `permissions` may reach `path`.
 * Returns false for any path not explicitly mapped above (default deny).
 */
export function restrictedRoleMayAccess(path: string, permissions: string[]): boolean {
  const entry = ADMIN_PATH_PERMISSIONS.find(
    (e) => path === e.prefix || path.startsWith(e.prefix + '/')
  )
  if (!entry) return false
  return entry.anyOf.some((key) => permissions.includes(key))
}
