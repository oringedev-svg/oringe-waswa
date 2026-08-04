'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LogOut } from 'lucide-react'
import TeamCentre from '@/components/admin/TeamCentre'

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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-raised)' }}>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="font-display font-semibold text-[var(--color-text-primary)]">
            Oringe Waswa &amp; Akude
          </Link>
          <button onClick={handleSignOut} className="btn btn-ghost gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="container py-10">
        <TeamCentre variant="desk" />
      </main>
    </div>
  )
}
