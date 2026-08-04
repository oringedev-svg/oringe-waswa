'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, LogOut, Users } from 'lucide-react'
import { LoadingState, EmptyState } from '@/components/admin/ui'

interface TeamMemberCard {
  id: string
  full_name: string
  position: string | null
  seniority: string | null
  avatar_url: string | null
  open_work: number
  is_me: boolean
}

interface Team {
  key: string
  label: string
  basis: string
  members: TeamMemberCard[]
}

export default function DeskTeamPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [linked, setLinked] = useState(true)

  useEffect(() => {
    fetch('/api/desk/team')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setTeams(d?.teams || [])
        setLinked(!!d?.teamMember)
      })
      .finally(() => setLoading(false))
  }, [])

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

      <main className="container py-10 max-w-5xl">
        <Link href="/desk" className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to my desk
        </Link>

        <div className="mb-8">
          <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
            Team Centre
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">My Team</h1>
        </div>

        {loading ? (
          <LoadingState label="Loading your team" />
        ) : !linked ? (
          <EmptyState
            icon={Users}
            title="No team profile yet"
            description="Your account isn't linked to a team profile, so we can't work out who your colleagues are. Ask an administrator to link it from Team."
          />
        ) : teams.length === 0 ? (
          <EmptyState icon={Users} title="No team found" description="Nobody else is on record alongside you yet." />
        ) : (
          <div className="space-y-8">
            {teams.map((team) => (
              <div key={team.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{team.label}</h2>
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    {team.members.length} {team.members.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">{team.basis}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {team.members.map((m) => (
                    <div
                      key={m.id}
                      className={`card p-4 flex items-start gap-3 ${m.is_me ? 'border-[var(--color-accent)]' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-surface-overlay)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 relative">
                        {m.avatar_url ? (
                          <Image src={m.avatar_url} alt={m.full_name} fill className="object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[var(--color-accent)]">
                            {m.full_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {m.full_name}
                          {m.is_me && <span className="ml-1.5 text-[0.65rem] text-[var(--color-accent)]">you</span>}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] truncate">{m.position}</div>
                        {/* Workload, so the page answers "who is free" rather
                            than only "who exists". */}
                        <div className="text-[0.65rem] text-[var(--color-text-muted)] mt-1.5">
                          {m.open_work === 0 ? 'No open work' : `${m.open_work} open ${m.open_work === 1 ? 'item' : 'items'}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
