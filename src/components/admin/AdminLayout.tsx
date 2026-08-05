'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, LayoutGrid, ChevronRight, History, Sun, Moon, LogOut, HelpCircle, X,
  Scale, Gavel, Landmark, Inbox, ChevronDown, ChevronUp, BookOpen, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_DOMAINS, domainForPath } from '@/lib/adminDomains'
import { createClient } from '@/lib/supabase'
import AdminAIAssistant from './AdminAIAssistant'
import GlobalSearch from './GlobalSearch'
import PushNotificationBell from './PushNotificationBell'
import HelpWidget from '@/components/help/HelpWidget'

// The shell is a slim top bar plus a persistent left sidebar that appears
// once you are inside one of the four domains: the sidebar lists that
// domain's own tools so lateral moves (Blog -> Media) never need the
// launcher. The launcher (a command-palette-style overlay) is kept for
// jumping BETWEEN domains and to the dashboard. The domain model itself
// lives in src/lib/adminDomains.ts.
const SYSTEM_ITEMS = [
  { href: '/admin/audit-log', icon: History, label: 'Audit Log' },
  { href: '/admin/help', icon: HelpCircle, label: 'Manual' },
]

// The capability navigation from the Entrora UI brief (§2), mapped only to
// surfaces that actually exist. Three items from the brief are deliberately
// absent rather than shipped as dead links:
//
//   Assistant     - the AI Gateway capability is not built. An AI assistant
//                   widget already floats on every admin screen, so a nav
//                   item pointing at nothing would be worse than none.
//   Workflows     - the Workflow Engine capability is not built.
//   Work Exchange - the brief itself says not to build it without first
//                   confirming what it is meant to be.
// requiredPermission is undefined for lanes everyone with an admin-area
// login should see; 'admin' bypasses every check below regardless. Without
// this, a pupil with zero grants saw the exact same firm-wide navigation
// (Matters, Court & Deadlines, Money) as a partner, the "admin mode" the
// sidebar visually implies even though the API underneath was correctly
// scoped, the chrome itself was the leak.
const WORK_LANES: { href: string; icon: typeof LayoutDashboard; label: string; requiredPermission?: string }[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'My Desk' },
  { href: '/admin/submissions', icon: Inbox, label: 'New Work' },
  { href: '/admin/matters', icon: Scale, label: 'Matters', requiredPermission: 'manage_matters' },
  { href: '/admin/court-calendar', icon: Gavel, label: 'Court & Deadlines', requiredPermission: 'manage_matters' },
  { href: '/admin/finance', icon: Landmark, label: 'Money', requiredPermission: 'manage_billing' },
]

const SECONDARY_LINKS = [
  { href: '/admin/hubs', icon: BookOpen, label: 'Hubs' },
  { href: '/admin/engines', icon: Cpu, label: 'Engines' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [showDomainTools, setShowDomainTools] = useState(false)
  const [canTriage, setCanTriage] = useState(false)
  const [profile, setProfile] = useState<{ fullName: string; role: string } | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const launcherRef = useRef<HTMLDivElement>(null)

  // Via /api/me rather than reading profiles straight from the browser.
  // A direct anon-key read is bound by row-level security, so a missing or
  // self-referential policy on profiles silently blanks the signed-in
  // user's name and role in the top bar. /api/me resolves it server-side
  // where identity is already established.
  useEffect(() => {
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(me => {
        if (me?.fullName || me?.role) setProfile({ fullName: me.fullName, role: me.role })
        setPermissions(Array.isArray(me?.permissions) ? me.permissions : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/my-desk')
      .then(r => (r.ok ? r.json() : null))
      .then(desk => setCanTriage(Boolean(desk?.canTriage)))
      .catch(() => setCanTriage(false))
  }, [])

  useEffect(() => {
    setLauncherOpen(false)
    setShowDomainTools(false)
  }, [pathname])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) setLauncherOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setLauncherOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const domain = domainForPath(pathname)
  const currentTool = domain?.tools.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))
  // "Admin" reads as a claim about the account's access level to anyone
  // who isn't staff, a pupil landing here off their own assignment link
  // shouldn't see a label implying they're in an admin panel.
  const isStaffTier = profile ? ['admin', 'staff', 'moderator'].includes(profile.role) : true
  const brandLabel = isStaffTier ? 'OWA Admin' : 'Oringe Waswa & Akude'
  const homeLabel = isStaffTier ? 'Admin' : 'Workspace'

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <a href="#admin-main-content" className="skip-link">Skip to workspace content</a>
      {/* Top bar, persistent chrome. */}
      <header className="admin-topbar">
        <div className="flex items-center gap-4 px-4 md:px-6 h-14">
          {/* The launcher only ever points at the dashboard, the 4 domains,
              and system pages, none of which a pupil or admin assistant can
              actually reach (middleware bounces them back to /desk), so the
              button itself is dropped rather than offering dead ends. */}
          {isStaffTier && (
          <div className="relative flex-shrink-0" ref={launcherRef}>
            <button
              onClick={() => setLauncherOpen(o => !o)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors border border-transparent',
                launcherOpen
                  ? 'bg-[color-mix(in_srgb,var(--band-accent)_15%,transparent)] text-[var(--on-band-strong)] border-[color-mix(in_srgb,var(--band-accent)_35%,transparent)]'
                  : 'text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)]'
              )}
              title="Open navigation"
            >
              {launcherOpen ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              <span className="hidden sm:inline">Menu</span>
            </button>

            {launcherOpen && (
              <div className="absolute left-0 top-full mt-2 w-[min(92vw,640px)] max-h-[calc(100vh-5rem)] overflow-y-auto bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-xl)] p-4 animate-slide-down">
                <Link href="/admin"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-md text-sm mb-2 transition-colors',
                    pathname === '/admin'
                      ? 'bg-[color-mix(in_srgb,var(--color-brand)_10%,var(--color-surface))] text-[var(--color-text-primary)] border border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'
                  )}>
                  <LayoutDashboard className={cn('w-4 h-4 flex-shrink-0', pathname === '/admin' && 'text-[var(--color-brand)]')} />
                  Dashboard
                </Link>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ADMIN_DOMAINS.map(d => (
                    <Link key={d.key} href={d.href}
                      className={cn(
                        'flex items-start gap-3 p-3 min-h-11 rounded-md transition-colors border',
                        pathname === d.href
                          ? 'border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-brand)_8%,var(--color-surface))]'
                          : 'border-transparent hover:bg-[var(--color-surface-overlay)]'
                      )}>
                      <div className="w-8 h-8 rounded-md bg-[color-mix(in_srgb,var(--color-brand)_12%,transparent)] flex items-center justify-center flex-shrink-0">
                        <d.icon className="w-4 h-4 text-[var(--color-brand)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{d.label}</div>
                        <div className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-0.5">{d.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-1.5">
                  {SYSTEM_ITEMS.map(item => (
                    <Link key={item.href} href={item.href}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 min-h-9 rounded-md text-xs transition-colors',
                        pathname.startsWith(item.href)
                          ? 'bg-[color-mix(in_srgb,var(--color-brand)_10%,var(--color-surface))] text-[var(--color-text-primary)] border border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] font-medium'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'
                      )}>
                      <item.icon className={cn('w-3.5 h-3.5', pathname.startsWith(item.href) && 'text-[var(--color-brand)]')} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          <Link href={isStaffTier ? '/admin' : '/desk'} className="font-display text-[var(--on-band-strong)] hidden sm:block flex-shrink-0 tracking-tight">{brandLabel}</Link>

          <div className="flex-1" />

          <GlobalSearch />

          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <PushNotificationBell />
            {profile && (
              <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 ml-0.5 sm:ml-1 border-l border-[color-mix(in_srgb,var(--on-band)_15%,transparent)]">
                <div className="text-right hidden lg:block">
                  <div className="text-sm font-medium text-[var(--on-band)] leading-tight">{profile.fullName}</div>
                  <div className="text-xs text-[var(--on-band-muted)] leading-tight capitalize">{profile.role}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Fixed capability sidebar (Entrora UI brief §2). Always present,
            not only inside a domain, because these are the capabilities
            themselves rather than one domain's tools. The current domain's
            tools still list underneath, so nothing that was reachable
            before becomes unreachable. Hidden on mobile, where the
            launcher carries navigation instead. */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-head">
            <span>Work now</span>
          </div>
          <nav className="admin-sidebar-nav">
            {WORK_LANES.filter(item => {
              if (item.href === '/admin/submissions') return canTriage
              if (item.requiredPermission) return profile?.role === 'admin' || permissions.includes(item.requiredPermission)
              return true
            }).map(item => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname === item.href || pathname.startsWith(item.href + '/')
              // '/admin' is the one lane every signed-in role sees, but it's
              // closed to restricted roles -- their equivalent is /desk.
              const href = item.href === '/admin' && !isStaffTier ? '/desk' : item.href
              return (
                <Link key={item.href} href={href}
                  className={cn('admin-sidebar-item', active && 'is-active')}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {domain && (
            <>
              <button
                type="button"
                onClick={() => setShowDomainTools(open => !open)}
                className="admin-sidebar-head admin-sidebar-head-sub w-full text-left flex items-center gap-2"
                aria-expanded={showDomainTools}
              >
                <domain.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">More in {domain.label}</span>
                {showDomainTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showDomainTools && (
                <nav className="admin-sidebar-nav">
                  {domain.tools.map(tool => {
                    const active = pathname === tool.href || pathname.startsWith(tool.href + '/')
                    return (
                      <Link key={tool.href} href={tool.href}
                        className={cn('admin-sidebar-item', active && 'is-active')}>
                        <tool.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{tool.label}</span>
                      </Link>
                    )
                  })}
                </nav>
              )}
            </>
          )}

          {/* Hubs and Engines are firm-wide reference and automation
              surfaces with no per-permission mapping, so they stay closed to
              restricted roles and are hidden rather than shown as links that
              bounce. */}
          {isStaffTier && (
            <div className="admin-sidebar-secondary">
              {SECONDARY_LINKS.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return <Link key={item.href} href={item.href} className={cn('admin-sidebar-link', active && 'is-active')}><item.icon className="w-3.5 h-3.5" />{item.label}</Link>
              })}
            </div>
          )}
        </aside>

        <main id="admin-main-content" tabIndex={-1} className="admin-main">
          {/* Breadcrumbs, on every page, so wayfinding is always visible
              (the old version tucked these into the top bar and hid them on
              mobile). */}
          <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
            {/* A restricted role reaches an admin page only via a specific
                permission (see adminPathAccess.ts), so neither /admin nor the
                page's domain hub is open to them -- both crumbs would bounce
                straight to /desk. Home points at their own workspace, and the
                domain is shown as context rather than offered as a link. */}
            <Link href={isStaffTier ? '/admin' : '/desk'}>{homeLabel}</Link>
            {domain && (
              <>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                {isStaffTier ? (
                  <Link href={domain.href}>{domain.label}</Link>
                ) : (
                  <span>{domain.label}</span>
                )}
              </>
            )}
            {currentTool && (
              <>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                <span className="admin-breadcrumbs-current">{currentTool.label}</span>
              </>
            )}
          </nav>

          {children}
        </main>
      </div>

      <AdminAIAssistant />
      <HelpWidget position="bottom-left" manualHref="/admin/help" />
    </div>
  )
}
