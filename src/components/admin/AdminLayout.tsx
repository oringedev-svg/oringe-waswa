'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, LayoutGrid, ChevronRight, History, Sun, Moon, Bell, LogOut, HelpCircle, X,
  Scale, Gavel, Folder, Lightbulb, BarChart2, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_DOMAINS, domainForPath } from '@/lib/adminDomains'
import { createClient } from '@/lib/supabase'
import AdminAIAssistant from './AdminAIAssistant'
import GlobalSearch from './GlobalSearch'
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
const CAPABILITY_NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'Command Center' },
  { href: '/admin/matters', icon: Scale, label: 'Matters' },
  { href: '/admin/court-calendar', icon: Gavel, label: 'Court Calendar' },
  { href: '/admin/documents', icon: Folder, label: 'Documents' },
  { href: '/admin/knowledge', icon: Lightbulb, label: 'Knowledge Vault' },
  { href: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [profile, setProfile] = useState<{ fullName: string; role: string } | null>(null)
  const launcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name, role').eq('user_id', user.id).single()
      if (data) setProfile({ fullName: data.full_name, role: data.role })
    })
  }, [])

  useEffect(() => { setLauncherOpen(false) }, [pathname])

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

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Top bar, persistent chrome. */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md">
        <div className="flex items-center gap-4 px-4 md:px-6 h-14">
          <div className="relative flex-shrink-0" ref={launcherRef}>
            <button
              onClick={() => setLauncherOpen(o => !o)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
                launcherOpen ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'
              )}
              title="Open navigation"
            >
              {launcherOpen ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              <span className="hidden sm:inline">Menu</span>
            </button>

            {launcherOpen && (
              <div className="absolute left-0 top-full mt-2 w-[min(92vw,640px)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-xl)] p-4 animate-slide-down">
                <Link href="/admin"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm mb-2 transition-colors',
                    pathname === '/admin' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'
                  )}>
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  Dashboard
                </Link>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ADMIN_DOMAINS.map(d => (
                    <Link key={d.key} href={d.href}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-md transition-colors border',
                        pathname === d.href ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-transparent hover:bg-[var(--color-surface-overlay)]'
                      )}>
                      <div className="w-8 h-8 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                        <d.icon className="w-4 h-4 text-[var(--color-accent)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{d.label}</div>
                        <div className="text-xs text-[var(--color-muted)] line-clamp-2 mt-0.5">{d.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-1.5">
                  {SYSTEM_ITEMS.map(item => (
                    <Link key={item.href} href={item.href}
                      className={cn(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                        pathname.startsWith(item.href) ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'
                      )}>
                      <item.icon className="w-3.5 h-3.5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/admin" className="font-display font-semibold text-[var(--color-text-primary)] hidden sm:block flex-shrink-0">OWA Admin</Link>

          <div className="flex-1" />

          <GlobalSearch />

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn btn-ghost p-2 !px-2" title="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="btn btn-ghost p-2 !px-2 relative" title="Notifications">
              <Bell className="w-4 h-4" />
            </button>
            {profile && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[var(--color-border)]">
                <div className="text-right hidden lg:block">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">{profile.fullName}</div>
                  <div className="text-xs text-[var(--color-muted)] leading-tight capitalize">{profile.role}</div>
                </div>
                <button onClick={handleSignOut} className="btn btn-ghost p-2 !px-2" title="Sign out">
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
            <span>Capabilities</span>
          </div>
          <nav className="admin-sidebar-nav">
            {CAPABILITY_NAV.map(item => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}
                  className={cn('admin-sidebar-item', active && 'is-active')}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {domain && (
            <>
              <div className="admin-sidebar-head admin-sidebar-head-sub">
                <domain.icon className="w-4 h-4 flex-shrink-0" />
                <span>{domain.label}</span>
              </div>
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
            </>
          )}
        </aside>

        <main className="admin-main">
          {/* Breadcrumbs, on every page, so wayfinding is always visible
              (the old version tucked these into the top bar and hid them on
              mobile). */}
          <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/admin">Admin</Link>
            {domain && (
              <>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                <Link href={domain.href}>{domain.label}</Link>
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
