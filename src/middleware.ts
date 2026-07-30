import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Routes under /api that require a signed-in admin/staff/moderator user
// for every method, including GET, these never serve public data.
const ALWAYS_PROTECTED_API = [
  '/api/submissions',
  '/api/appointments',
  '/api/people',
  '/api/accounts',
  '/api/files/matters',
  '/api/files/documents',
  '/api/conflict-checks',
  '/api/time-entries',
  '/api/invoices',
  '/api/matter-notes',
  '/api/matter-tasks',
  '/api/calendar-events',
  '/api/legal-knowledge',
  '/api/service-of-process',
  '/api/legal-instruments',
  '/api/fee-rules',
  '/api/matter-fees',
  '/api/cost-forecasts',
  '/api/organization',
  '/api/reports',
  '/api/audit-log',
  '/api/ai/admin-assistant',
  '/api/mail',
  '/api/team/messages',
  '/api/settings/keys',
  '/api/users',
  '/api/permissions',
  '/api/admin-search',
  '/api/analytics/summary',
  '/api/dashboard',
]

// Routes that serve public GET data but whose write methods are admin-only.
const MUTATION_PROTECTED_API = [
  '/api/blog',
  '/api/team',
  '/api/gallery',
  '/api/certificates',
  '/api/insights',
  '/api/coverage',
  '/api/awards',
  '/api/events',
  '/api/resources',
]

// Always-public exceptions within an otherwise mutation-protected prefix.
const PUBLIC_EXCEPTIONS = [/^\/api\/resources\/[^/]+\/download$/]

// These are otherwise-protected collections (admin GET/list is private) whose
// exact base-path POST is how the public contact and appointment-booking
// forms create a new record. Only the exact base path is exempted, GET on
// it and everything under /:id (admin detail/update/delete) stays protected.
const PUBLIC_CREATE_API = ['/api/submissions', '/api/appointments']

function isPublicCreate(path: string, method: string) {
  return method === 'POST' && PUBLIC_CREATE_API.includes(path)
}

// The client portal needs a signed-in user of ANY role, clients included.
// These paths get the authentication check but skip the admin-role check.
function isPortalPath(path: string) {
  return path === '/portal' || path.startsWith('/portal/') || path.startsWith('/api/portal')
}

// /api/settings is admin-only, but /api/settings/public is intentionally public.
function isProtectedSettingsPath(path: string) {
  return path === '/api/settings' || path.startsWith('/api/settings/') && !path.startsWith('/api/settings/public')
}

function isAlwaysProtectedApi(path: string) {
  return ALWAYS_PROTECTED_API.some((p) => path === p || path.startsWith(p + '/')) || isProtectedSettingsPath(path)
}

function isMutationProtectedApi(path: string, method: string) {
  if (method === 'GET') {
    // The admin listing view of blog posts is requested with ?admin=true, that
    // must not be readable without a session even though GET is otherwise public.
    return false
  }
  if (PUBLIC_EXCEPTIONS.some((re) => re.test(path))) return false
  return MUTATION_PROTECTED_API.some((p) => path === p || path.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })
  const path = request.nextUrl.pathname
  const method = request.method

  const isAdminGetWithAdminFlag = path.startsWith('/api/blog') && method === 'GET' && request.nextUrl.searchParams.get('admin') === 'true'

  const needsAuth =
    (path.startsWith('/admin') && path !== '/login') ||
    path.startsWith('/desk') ||
    path.startsWith('/api/desk') ||
    isPortalPath(path) ||
    (isAlwaysProtectedApi(path) && !isPublicCreate(path, method)) ||
    isMutationProtectedApi(path, method) ||
    isAdminGetWithAdminFlag

  if (!needsAuth) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isApi = path.startsWith('/api')

  if (!user) {
    if (isApi) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Portal paths only need a signed-in user, any role, clients included.
  if (isPortalPath(path)) return response

  // The role lookup deliberately does NOT go through the session client.
  //
  // `supabase` above is the anon key plus the caller's cookies, so it is
  // bound by row-level security. Resolving "what role is this user" is a
  // trusted server-side authorization step that happens AFTER identity is
  // already proven by auth.getUser() above, and making it depend on an RLS
  // policy over profiles is both unnecessary and fragile: any policy on
  // that table which is missing, or which queries profiles itself and so
  // recurses, silently returns no row here and locks every staff member
  // out of /admin entirely. That is exactly what happened once already.
  // A service-role read has no policy to trip over.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: profile } = await admin.from('profiles').select('role').eq('user_id', user.id).single()
  const allowedRoles = ['admin', 'staff', 'moderator', 'pupil', 'admin_assistant']
  const authorized = !!profile && allowedRoles.includes(profile.role)

  if (!authorized) {
    if (isApi) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  // Pupils and administrative assistants start with zero permissions, and
  // the general /admin shell (the Menu launcher's domain list, each
  // domain's own sub-nav, the hub pages themselves) was built assuming a
  // signed-in admin user, not "someone with maybe zero grants." Every one
  // of those surfaces would need its own permission check to be safe, and
  // auditing every current and future admin page for that is exactly the
  // whack-a-mole this replaces: these two roles get the front door to
  // /desk and to the one thing that's genuinely theirs, an individual
  // assignment (access to that is still enforced per-row by its own API,
  // this is just keeping them out of pages that were never scoped for
  // them at all). Everyone else's access is unchanged.
  const restrictedRoles = ['pupil', 'admin_assistant']
  const isOwnAssignmentPage = /^\/admin\/assignments(\/[^/]+)?$/.test(path)
  if (restrictedRoles.includes(profile!.role) && path.startsWith('/admin') && !isOwnAssignmentPage) {
    if (isApi) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    const url = request.nextUrl.clone()
    url.pathname = '/desk'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/portal/:path*', '/portal', '/desk/:path*', '/desk'],
}
