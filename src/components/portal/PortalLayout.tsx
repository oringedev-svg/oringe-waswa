'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, Calendar, Trello, MessageSquare, FileText, Receipt,
  Sun, Moon, Bell, LogOut, X, LayoutGrid, Scale, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import HelpWidget from '@/components/help/HelpWidget'

const PORTAL_LANES = [
  { href: '/portal', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/portal/assignments', icon: Trello, label: 'Assignments' },
  { href: '/portal/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/portal/messages', icon: MessageSquare, label: 'Messages' },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [profile, setProfile] = useState<{ fullName: string } | null>(null)
  const launcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(me => {
        if (me?.fullName) setProfile({ fullName: me.fullName })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLauncherOpen(false)
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

  const currentTool = PORTAL_LANES.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <a href="#portal-main-content" className="skip-link">Skip to portal content</a>
      <header className="admin-topbar">
        <div className="flex items-center gap-4 px-4 md:px-6 h-14">
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
              <div className="absolute left-0 top-full mt-2 w-[min(92vw,320px)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-xl)] p-4 animate-slide-down">
                <div className="grid grid-cols-1 gap-1">
                  {PORTAL_LANES.map(d => (
                    <Link key={d.href} href={d.href}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-md transition-colors border',
                        pathname === d.href
                          ? 'border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-brand)_8%,var(--color-surface))] text-[var(--color-text-primary)]'
                          : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'
                      )}>
                      <d.icon className={cn('w-4 h-4 flex-shrink-0', pathname === d.href && 'text-[var(--color-brand)]')} />
                      <span className="text-sm font-medium">{d.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/portal" className="font-display text-[var(--on-band-strong)] hidden sm:block flex-shrink-0 tracking-tight">Oringe Waswa Portal</Link>

          <div className="flex-1" />

          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href="/portal/messages" className="p-2 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors relative" title="Messages">
              <MessageSquare className="w-4 h-4" />
            </Link>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors" title="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="p-2 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors relative" title="Notifications">
              <Bell className="w-4 h-4" />
            </button>
            {profile && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-[color-mix(in_srgb,var(--on-band)_15%,transparent)]">
                <div className="text-right hidden lg:block">
                  <div className="text-sm font-medium text-[var(--on-band)] leading-tight">{profile.fullName}</div>
                  <div className="text-xs text-[var(--on-band-muted)] leading-tight">Client</div>
                </div>
                <button onClick={handleSignOut} className="p-2 rounded-md text-[var(--on-band-muted)] hover:bg-[color-mix(in_srgb,var(--on-band)_8%,transparent)] hover:text-[var(--on-band)] transition-colors" title="Sign out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-head">
            <span>Portal Menu</span>
          </div>
          <nav className="admin-sidebar-nav">
            {PORTAL_LANES.map(item => {
              const active = item.href === '/portal'
                ? pathname === '/portal'
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
        </aside>

        <main id="portal-main-content" tabIndex={-1} className="admin-main">
          {children}
        </main>
      </div>

      <HelpWidget position="bottom-left" manualHref="/portal/help" />
    </div>
  )
}
