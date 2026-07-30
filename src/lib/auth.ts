import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { createAdminClient } from './supabase'
import { userHasPermission } from './permissions'
import { checkPermission, recordSecurityAudit, type ScopeType } from './checkPermission'

export const ADMIN_ROLES = ['admin', 'staff', 'moderator'] as const

export interface SessionProfile {
  id: string
  userId: string
  email: string
  fullName: string
  role: string
}

export function isAdminRole(role?: string | null): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}

/** Server client bound to the current request's cookies (Route Handlers, Server Components). */
export function createRouteSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {}
        },
      },
    }
  )
}

/** Returns the signed-in user's profile (role included), or null if not signed in / no profile row. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = createRouteSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Identity is already proven above by auth.getUser(), which validates the
  // session token. Loading that user's own profile row is a trusted
  // server-side step, so it goes through the service-role client rather
  // than the RLS-bound session client.
  //
  // This is not a shortcut, it is the fix for a real outage: this function
  // backs both /api/me and requireAdminApi, so EVERY admin API depends on
  // it. When a policy on profiles is missing, or queries profiles and
  // therefore recurses, an RLS-bound read here returns nothing, this
  // returns null, and every admin endpoint answers 401 while the user is
  // perfectly well signed in. The panel loads and then fails at everything,
  // which reads to the user as "I cannot log in".
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('user_id', user.id)
    .single()

  if (!profile) return null
  return { id: profile.id, userId: user.id, email: profile.email, fullName: profile.full_name, role: profile.role }
}

/**
 * Guard for use at the top of an API route handler. Returns the session
 * profile if the caller is signed in with an admin/staff/moderator role,
 * or a ready-to-return 401/403 NextResponse otherwise.
 */
export async function requireAdminApi(): Promise<{ profile: SessionProfile } | { response: NextResponse }> {
  const profile = await getSessionProfile()
  if (!profile) {
    return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }
  if (!isAdminRole(profile.role)) {
    return { response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
  }
  return { profile }
}

/**
 * Guard for a specific permission (on top of the base admin/staff/moderator
 * role check). Use for actions a role can reach but shouldn't automatically
 * be allowed to perform, e.g. publishing an article or changing settings.
 */
export async function requirePermissionApi(
  permissionKey: string,
  scope?: { scopeType?: ScopeType; scopeId?: string | null }
): Promise<{ profile: SessionProfile } | { response: NextResponse }> {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard

  // Two checks, deliberately, during the migration onto Entrora's
  // Authorization capability:
  //
  //   1. CheckPermission, which is scope-aware (I1/I2) and is what every
  //      capability spec expects command handlers to call.
  //   2. The original flat role/grant check.
  //
  // Access is granted if EITHER allows it. This is a widening, not a
  // narrowing: cutting straight over to the new resolver would mean any
  // gap in the seeded role_permissions instantly locks a real person out
  // of a screen they have always been able to use. The legacy path is
  // removed once the permission matrix is confirmed complete against
  // Authorization spec §10, not before.
  const scoped = await checkPermission({
    userId: guard.profile.userId,
    permissionKey,
    scopeType: scope?.scopeType,
    scopeId: scope?.scopeId,
    // Audited below, once, so a request the legacy path allows is never
    // recorded as a denial.
    audit: false,
  })
  if (scoped.allowed) return { profile: guard.profile }

  const legacyAllowed = await userHasPermission(guard.profile.userId, guard.profile.role, permissionKey)
  if (legacyAllowed) return { profile: guard.profile }

  // Genuinely denied by both resolvers: record it (Authorization spec §5,
  // denied attempts are recorded, not just successes).
  await recordSecurityAudit({
    eventType: 'PermissionCheckDenied.v1',
    actor: guard.profile.userId,
    permissionKey,
    scopeType: scope?.scopeType ?? 'firm',
    scopeId: scope?.scopeId ?? null,
    outcome: 'denied',
    detail: { reason: scoped.reason ?? 'no matching role or grant', role: guard.profile.role },
  })

  return { response: NextResponse.json({ error: `Missing permission: ${permissionKey}` }, { status: 403 }) }
}
