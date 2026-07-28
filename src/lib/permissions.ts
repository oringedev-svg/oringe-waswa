import { createAdminClient } from './supabase'

// Baseline permissions implied by a role, before any individual grants.
// 'admin' is intentionally absent, admins always have every permission,
// checked separately rather than listed here.
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  // Staff progress matters, run conflict searches, and log time day-to-day,
  // but partner calls, approving a conflict decision (approve_conflict_waiver)
  // and issuing/settling invoices (manage_billing), are admin-only unless
  // explicitly granted to an individual.
  staff: ['manage_lawyers', 'manage_media', 'manage_homepage', 'manage_forms', 'publish_articles', 'manage_matters', 'run_conflict_check', 'log_time'],
  moderator: ['approve_articles', 'manage_forms', 'manage_testimonials', 'manage_faqs'],
  client: [],
  public: [],
  // Pupils and administrative assistants start with nothing, on purpose.
  // Every capability they have comes from an explicit per-user grant (the
  // same modular "all or some" mechanism used for staff), assigned on
  // /admin/users once someone decides what a specific person should touch.
  pupil: [],
  admin_assistant: [],
}

export interface PermissionRecord {
  key: string
  label: string
  category: string
  description: string | null
}

export async function getPermissionCatalog(): Promise<PermissionRecord[]> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('permissions').select('*').order('category').order('label')
  return data || []
}

/** Resolves the full set of permission keys a user effectively has: role defaults + explicit grants. Admin gets everything. */
export async function getUserPermissions(userId: string, role: string): Promise<Set<string>> {
  if (role === 'admin') {
    const catalog = await getPermissionCatalog()
    return new Set(catalog.map((p) => p.key))
  }

  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || []
  const supabase = createAdminClient()
  const { data } = await supabase.from('user_permissions').select('permission_key').eq('user_id', userId)
  const granted = (data || []).map((r) => r.permission_key)

  return new Set([...defaults, ...granted])
}

export async function userHasPermission(userId: string, role: string, key: string): Promise<boolean> {
  if (role === 'admin') return true
  const perms = await getUserPermissions(userId, role)
  return perms.has(key)
}
