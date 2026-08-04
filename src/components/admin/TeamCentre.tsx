'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Bell, Calendar as CalendarIcon, Clock, MapPin, Video, Gavel, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, MATTER_TYPES } from '@/lib/utils'
import { LoadingState, EmptyState } from '@/components/admin/ui'
import { toolsForPermissions } from '@/lib/permissionTools'

interface DeskTask {
  id: string
  title: string
  status: string
  due_date: string | null
  matter: { id: string; matter_number: string; title: string; type: string } | null
  submission: { id: string; tracking_code: string; submitter_name: string } | null
}

interface DeskMeeting {
  id: string
  title: string
  type: string
  start_at: string
  end_at: string
  location: string | null
  meeting_link: string | null
  status: string
}

interface DeskOverview {
  teamMember: { id: string; full_name: string; position: string; seniority: string } | null
  tasks: DeskTask[]
  reviewQueue: unknown[]
  meetings: DeskMeeting[]
  permissions: string[]
}

function matterTypeLabel(type?: string) {
  if (!type) return null
  return MATTER_TYPES.find((m) => m.value === type)?.label || type.replace(/_/g, ' ')
}

// The landing workspace for anyone who isn't the managing admin: a pupil,
// an individual advocate, a team member scoped to one practice area. It
// never shows firm-wide metrics (that's the full dashboard, admin/page.tsx),
// only what's personally on their desk today: assigned tasks, today's
// meetings, and their calendar. Data comes from /api/desk/overview, which
// already existed as the personal-view backend before this component did.
// `variant` decides which links are safe to render, not how it looks.
// Middleware bounces pupils and administrative assistants out of /admin
// entirely except their own assignment pages, so the same component
// rendered at /desk must not offer links that would just bounce them
// back here. See src/middleware.ts's restrictedRoles block.
export default function TeamCentre({ variant = 'admin' }: { variant?: 'admin' | 'desk' } = {}) {
  const [loading, setLoading] = useState(true)
  const [desk, setDesk] = useState<DeskOverview | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [view, setView] = useState<'daily' | 'monthly'>('monthly')
  const [cursor, setCursor] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  useEffect(() => {
    Promise.all([
      fetch('/api/desk/overview').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/conversations').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([deskData, convos]) => {
        setDesk(deskData)
        const unread = (convos?.conversations || []).reduce(
          (sum: number, c: { unread_count?: number }) => sum + (c.unread_count || 0),
          0
        )
        setUnreadMessages(unread)
      })
      .finally(() => setLoading(false))
  }, [])

  const tasks = desk?.tasks || []
  const meetings = desk?.meetings || []
  const reviewCount = desk?.reviewQueue?.length || 0

  const todayStr = new Date().toISOString().slice(0, 10)

  const grouped = useMemo(() => {
    const overdue: DeskTask[] = []
    const today: DeskTask[] = []
    const upcoming: DeskTask[] = []
    for (const t of tasks) {
      if (!t.due_date) { upcoming.push(t); continue }
      if (t.due_date < todayStr) overdue.push(t)
      else if (t.due_date === todayStr) today.push(t)
      else upcoming.push(t)
    }
    return { overdue, today, upcoming }
  }, [tasks, todayStr])

  const todayMeetings = useMemo(
    () => meetings.filter((m) => m.start_at.slice(0, 10) === todayStr),
    [meetings, todayStr]
  )

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const startWeekday = monthStart.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()

  const cells = useMemo(() => {
    const arr: (number | null)[] = []
    for (let i = 0; i < startWeekday; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [startWeekday, daysInMonth])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, DeskMeeting[]>()
    for (const m of meetings) {
      const d = new Date(m.start_at)
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(m)
      }
    }
    return map
  }, [meetings, cursor])

  const dailyAgenda = useMemo(() => {
    const dayStr = selectedDay.toISOString().slice(0, 10)
    return meetings.filter((m) => m.start_at.slice(0, 10) === dayStr).sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [meetings, selectedDay])

  function selectDay(day: number) {
    setSelectedDay(new Date(cursor.getFullYear(), cursor.getMonth(), day))
    setView('daily')
  }

  if (loading) return <LoadingState label="Preparing your workspace" />

  const teamMember = desk?.teamMember
  const tools = toolsForPermissions(desk?.permissions || [])

  function TaskCard({ task, overdue }: { task: DeskTask; overdue?: boolean }) {
    return (
      <Link
        href={`/admin/assignments/${task.id}`}
        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-overlay)] transition-colors"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{task.title}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5 flex-wrap">
            {task.matter ? (
              <>
                <span className="truncate">{task.matter.matter_number} · {task.matter.title}</span>
                {matterTypeLabel(task.matter.type) && (
                  <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[0.65rem] flex-shrink-0">
                    {matterTypeLabel(task.matter.type)}
                  </span>
                )}
              </>
            ) : task.submission ? (
              <span className="truncate">{task.submission.submitter_name}</span>
            ) : (
              <span>General task</span>
            )}
          </div>
        </div>
        {task.due_date && (
          <span
            className={`flex-shrink-0 text-[0.68rem] font-medium px-2 py-1 rounded-full ${
              overdue ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]'
            }`}
          >
            {formatDate(task.due_date, 'short')}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
            Team Centre
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {teamMember ? `Welcome, ${teamMember.full_name.split(' ')[0]}` : 'Your workspace'}
          </h1>
          {teamMember?.position && <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{teamMember.position}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* /admin/messages is off-limits to the roles that land on /desk,
              so linking there would bounce them straight back to this page.
              Omitted rather than shipped as a dead link; those roles have no
              messages surface of their own yet. */}
          {variant === 'admin' && (
            <Link
              href="/admin/messages"
              className="relative p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-overlay)] transition-colors"
              title="Messages"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-accent)] text-white text-[0.6rem] font-semibold flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          )}
          {reviewCount > 0 && (
            <Link
              href="/admin/assignments"
              className="relative p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-overlay)] transition-colors"
              title="Work awaiting your review"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[0.6rem] font-semibold flex items-center justify-center">
                {reviewCount > 9 ? '9+' : reviewCount}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Nothing routes work to a person until their profile is linked to a
          team_members row -- assignments, meeting attendance and messages all
          resolve against that id, not profiles.id. Worth saying plainly here
          rather than leaving someone staring at three empty panels. */}
      {!teamMember && (
        <div className="card p-5 text-sm text-[var(--color-text-muted)]">
          Your account isn&apos;t linked to a team profile yet, so tasks, meetings, and messages assigned
          to you won&apos;t show here until it is. Ask an administrator to link it from Team.
        </div>
      )}

      {/* The only navigation these roles get: /desk has no admin shell around
          it, so without this a pupil granted, say, publish_articles would have
          no way to reach the blog at all. */}
      {variant === 'desk' && tools.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-3">My Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="card p-4 flex items-center gap-3 hover:border-[var(--color-accent)] transition-colors group"
              >
                <div className="w-9 h-9 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <t.icon className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                    {t.label}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] truncate">{t.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tasks */}
        <div className="lg:col-span-5 space-y-4">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Tasks</h2>

          {tasks.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="Nothing assigned right now"
              description="New work will show up here as it's assigned to you."
            />
          ) : (
            <div className="space-y-5">
              {grouped.overdue.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 mb-2">
                    Overdue ({grouped.overdue.length})
                  </div>
                  <div className="space-y-2">
                    {grouped.overdue.map((t) => <TaskCard key={t.id} task={t} overdue />)}
                  </div>
                </div>
              )}
              {grouped.today.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                    Today ({grouped.today.length})
                  </div>
                  <div className="space-y-2">
                    {grouped.today.map((t) => <TaskCard key={t.id} task={t} />)}
                  </div>
                </div>
              )}
              {grouped.upcoming.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                    Upcoming ({grouped.upcoming.length})
                  </div>
                  <div className="space-y-2">
                    {grouped.upcoming.map((t) => <TaskCard key={t.id} task={t} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Daily meetings */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Today&apos;s Meetings</h2>
          {todayMeetings.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing on your calendar today.</p>
          ) : (
            <div className="space-y-2">
              {todayMeetings.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{m.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    {new Date(m.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {(m.location || m.meeting_link) && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
                      {m.type === 'court' ? (
                        <Gavel className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
                      ) : m.meeting_link ? (
                        <Video className="w-3.5 h-3.5 flex-shrink-0 text-sky-500" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                      )}
                      {m.location || 'Video call'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Calendar</h2>
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setView('daily')}
                className={`px-2.5 py-1 rounded-md ${view === 'daily' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setView('monthly')}
                className={`px-2.5 py-1 rounded-md ${view === 'monthly' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]'}`}
              >
                Monthly
              </button>
            </div>
          </div>

          {view === 'monthly' ? (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-overlay)]/40">
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  className="p-1 hover:bg-[var(--color-surface-overlay)] rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold">
                  {cursor.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  className="p-1 hover:bg-[var(--color-surface-overlay)] rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-[0.65rem] font-semibold text-[var(--color-text-muted)] py-2 border-b border-[var(--color-border)]">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                  const now = new Date()
                  const isToday = !!day && cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth() && day === now.getDate()
                  const dayEvents = day ? eventsByDay.get(day) || [] : []
                  return (
                    <button
                      key={i}
                      disabled={!day}
                      onClick={() => day && selectDay(day)}
                      className={`aspect-square flex flex-col items-center justify-center text-xs border-b border-r border-[var(--color-border)]/40 last:border-r-0 hover:bg-[var(--color-surface-overlay)] transition-colors ${!day ? 'cursor-default' : ''}`}
                    >
                      {day && (
                        <>
                          <span
                            className={`w-6 h-6 flex items-center justify-center rounded-full ${
                              isToday ? 'bg-[var(--color-accent)] text-white font-semibold' : 'text-[var(--color-text-primary)]'
                            }`}
                          >
                            {day}
                          </span>
                          {dayEvents.length > 0 && <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] mt-0.5" />}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-overlay)]/40">
                <button
                  onClick={() => setSelectedDay(new Date(selectedDay.getTime() - 86400000))}
                  className="p-1 hover:bg-[var(--color-surface-overlay)] rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold">
                  {selectedDay.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <button
                  onClick={() => setSelectedDay(new Date(selectedDay.getTime() + 86400000))}
                  className="p-1 hover:bg-[var(--color-surface-overlay)] rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y divide-[var(--color-border)] max-h-80 overflow-y-auto">
                {dailyAgenda.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] p-4 text-center">No events this day.</p>
                ) : (
                  dailyAgenda.map((m) => (
                    <div key={m.id} className="p-3">
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{m.title}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        {new Date(m.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {new Date(m.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
