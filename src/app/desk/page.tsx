'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, LogOut, CheckSquare, Calendar, MessageSquare, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toolsForPermissions } from '@/lib/permissionTools'

interface Task {
  id: string
  title: string
  due_date: string | null
  matter?: { id: string; matter_number: string; title: string } | null
  submission?: { id: string; tracking_code: string; submitter_name: string } | null
}

interface Meeting {
  id: string
  title: string
  type: string
  start_at: string
  end_at: string
  location: string | null
  meeting_link: string | null
}

interface Message {
  id: string
  subject: string | null
  content: string
  is_broadcast: boolean
  is_read: boolean
  created_at: string
  sender?: { full_name: string } | null
}

interface Overview {
  teamMember: { id: string; full_name: string; position: string; seniority: string } | null
  tasks: Task[]
  meetings: Meeting[]
  messages: Message[]
  permissions: string[]
}

export default function DeskPage() {
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/desk/overview').then(r => (r.ok ? r.json() : null)),
      fetch('/api/me').then(r => (r.ok ? r.json() : null)),
    ]).then(([overview, me]) => {
      setData(overview)
      setName(me?.fullName || '')
    }).finally(() => setLoading(false))
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!data) return <div className="min-h-screen flex items-center justify-center text-[var(--color-muted)]">Could not load your desk.</div>

  const tools = toolsForPermissions(data.permissions)

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-raised)' }}>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="font-display font-semibold text-[var(--color-text-primary)]">Oringe Waswa &amp; Akude</Link>
          <button onClick={handleSignOut} className="btn btn-ghost gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="container py-10 max-w-4xl mx-auto">
        <div className="mb-8">
          <span className="eyebrow mb-2 block">My Desk</span>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
            {name ? `Welcome, ${name}` : 'Welcome'}
          </h1>
          {data.teamMember && (
            <p className="text-sm text-[var(--color-text-muted)] mt-1 capitalize">{data.teamMember.position} · {data.teamMember.seniority.replace(/_/g, ' ')}</p>
          )}
        </div>

        {!data.teamMember && (
          <div className="card p-5 mb-6 text-sm text-[var(--color-text-muted)]">
            Your account isn&apos;t linked to a team profile yet, so tasks, meetings, and messages assigned to you won&apos;t show here until it is. Ask an administrator to link it from Team.
          </div>
        )}

        {/* My Tools, only what their granted permissions unlock */}
        {tools.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-3">My Tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tools.map(t => (
                <Link key={t.href} href={t.href} className="card p-4 flex items-center gap-3 hover:border-[var(--color-accent)] transition-colors group">
                  <div className="w-9 h-9 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                    <t.icon className="w-4 h-4 text-[var(--color-accent)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">{t.label}</div>
                    <div className="text-xs text-[var(--color-muted)] truncate">{t.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Tasks */}
        <div className="card p-6 mb-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[var(--color-accent)]" /> My Tasks
          </h2>
          {data.tasks.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nothing assigned to you right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.tasks.map(t => {
                const overdue = t.due_date && t.due_date < new Date().toISOString().slice(0, 10)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm text-[var(--color-text-primary)]">{t.title}</div>
                      <div className="text-xs text-[var(--color-muted)] mt-0.5">
                        {t.matter ? `Matter ${t.matter.matter_number}` : t.submission ? `Enquiry ${t.submission.tracking_code}` : 'Internal'}
                      </div>
                    </div>
                    {t.due_date && (
                      <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-[var(--color-muted)]'}`}>
                        {overdue ? 'Overdue · ' : 'Due '}{formatDate(t.due_date, 'short')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* My Meetings */}
        <div className="card p-6 mb-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-accent)]" /> My Meetings
          </h2>
          {data.meetings.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nothing on your calendar.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.meetings.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)]">{m.title}</div>
                    <div className="text-xs text-[var(--color-muted)] mt-0.5">{m.location || (m.meeting_link ? 'Online' : 'No location set')}</div>
                  </div>
                  <span className="text-xs text-[var(--color-muted)] flex-shrink-0">
                    {formatDate(m.start_at, 'short')} · {new Date(m.start_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Messages */}
        <div className="card p-6">
          <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" /> My Messages
          </h2>
          {data.messages.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No messages yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.messages.map(m => (
                <div key={m.id} className="py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)]">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{m.subject || (m.is_broadcast ? 'Firm announcement' : 'Message')}</span>
                    <span className="text-xs text-[var(--color-muted)]">{m.sender?.full_name || 'Firm'} · {formatDate(m.created_at, 'short')}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{m.content}</p>
                </div>
              ))}
              <Link href="/admin/messages" className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline mt-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
