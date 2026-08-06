'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'
import { LogOut, Sun, Moon } from 'lucide-react'
import TeamCentre from '@/components/admin/TeamCentre'
import InstallAppButton from '@/components/layout/InstallAppButton'
import PushNotificationBell from '@/components/admin/PushNotificationBell'

// The personal workspace for pupils and administrative assistants, who
// middleware keeps out of /admin entirely (except their own assignment
// pages) -- see src/middleware.ts's restrictedRoles block, which is the
// single coarse gate protecting ~57 admin pages that do no permission
// checking of their own.
//
// This page used to be a second, sparser implementation of the same idea
// as TeamCentre, so the two drifted: the better-built one was only
// reachable by staff/moderator at /admin, and the roles who have nothing
// BUT this page got the weaker one. Same component now serves both, with
// `variant` deciding only which links are safe to render here. The
// security boundary is unchanged -- the component moved, nobody's access
// did.
export default function DeskPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  // The server can't know the visitor's stored theme, so it always renders
  // one icon and a client booting in dark mode renders the other, which React
  // flags as a hydration mismatch on every dark-mode load. Same guard the
  // public Navbar uses: render the icon only after mount.
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => { setThemeReady(true) }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-raised)' }}>
      {/* Sticky so the sign-out never scrolls out of reach; on mobile it's
          the ONLY chrome around the page. */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-40">
        <div className="container flex items-center justify-between gap-2 py-3">
          {/* Firm name truncates rather than wrapping to 2 lines and
              pushing sign-out down. Hidden text below sm since the whole
              app is under the same brand. */}
          <Link href="/" className="font-display font-semibold text-[var(--color-text-primary)] truncate min-w-0">
            <span className="hidden sm:inline">Oringe Waswa &amp; Akude</span>
            <span className="sm:hidden">OWA</span>
          </Link>
          {/* /desk never renders AdminLayout (see the note at the top of this
              file), so every affordance the admin top bar carries has to be
              repeated here or these two roles simply don't get it. That drift
              is why pupils and admin assistants were, until now, the only
              people using this app -- including anonymous strangers on the
              public site -- who could neither install it, switch theme, nor
              turn on notifications. None of those are permissions; they're
              personal comfort and device settings. */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <InstallAppButton variant="icon" tone="surface" />
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              title="Toggle theme"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {themeReady && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <PushNotificationBell tone="surface" />
            {/* Icon-only on mobile; label restored on sm+. Keeps the
                44px target. */}
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="btn btn-ghost inline-flex items-center justify-center gap-2 text-sm min-h-11 min-w-11 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* py-6 on mobile (was 10 -> 40px, wasted vertical space above
          the first content). Container already provides horizontal
          padding. */}
      <main className="container py-6 md:py-10">
        <TeamCentre variant="desk" />
      </main>
    </div>
  )
}
