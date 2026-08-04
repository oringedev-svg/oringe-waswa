'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Bell, Calendar as CalendarIcon, Clock, MapPin, Video, Gavel, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, MATTER_TYPES } from '@/lib/utils'
import { LoadingState, EmptyState } from '@/components/admin/ui'
import { toolsForPermissions } from '@/lib/permissionTools'
import { CALENDAR_KIND_STYLES, LEGEND_ORDER, kindFromEventType, styleFor, type CalendarItemKind } from '@/lib/calendarColors'

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

interface DeskHoliday {
  date: string
  name: string
  isNonWorkingDay: boolean
}

interface DeskOverview {
  teamMember: { id: string; full_name: string; position: string; seniority: string } | null
  tasks: DeskTask[]
  reviewQueue: unknown[]
  meetings: DeskMeeting[]
  permissions: string[]
  holidays: DeskHoliday[]
}

/** Local YYYY-MM-DD. toISOString() would shift the day for anyone east of
 *  UTC, which is everyone here -- a 9am Nairobi meeting must not land on
 *  the previous date in the grid. */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Today", "Tomorrow", "Yesterday", else a written date -- the Canvas-style
 *  heading for a day's worth of work. */
function dayHeading(dateStr: string, todayStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const today = new Date(`${todayStr}T00:00:00`)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-KE', { weekday: 'long' })
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
  const holidays = desk?.holidays || []
  const reviewCount = desk?.reviewQueue?.length || 0

  const todayStr = localISO(new Date())

  // Grouped by the day work is actually due rather than into three coarse
  // buckets, so the list reads as a schedule ("Tomorrow: two things") instead
  // of a pile. Overdue stays collapsed into one section at the top: the point
  // there is that it's late, not which day it was late from.
  const { overdue, byDay, undated } = useMemo(() => {
    const overdue: DeskTask[] = []
    const undated: DeskTask[] = []
    const dayMap = new Map<string, DeskTask[]>()
    for (const t of tasks) {
      if (!t.due_date) { undated.push(t); continue }
      const day = t.due_date.slice(0, 10)
      if (day < todayStr) { overdue.push(t); continue }
      if (!dayMap.has(day)) dayMap.set(day, [])
      dayMap.get(day)!.push(t)
    }
    return {
      overdue: overdue.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')),
      byDay: Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      undated,
    }
  }, [tasks, todayStr])

  // localISO, not start_at.slice(0,10): the latter reads the UTC date off
  // the timestamp, so a 1am Nairobi meeting (10pm UTC the day before) would
  // file itself under yesterday.
  const todayMeetings = useMemo(
    () => meetings.filter((m) => localISO(new Date(m.start_at)) === todayStr),
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

  // Everything that can occupy a day, in one shape, so the grid and the day
  // agenda read from a single list and a court date can't be styled one way
  // in one place and another elsewhere. A meeting's own type decides its
  // colour; a due assignment is a task; a public holiday is a holiday.
  const calendarItems = useMemo(() => {
    const items: { date: string; time: string | null; label: string; kind: CalendarItemKind; href?: string }[] = []

    for (const m of meetings) {
      const d = new Date(m.start_at)
      items.push({
        date: localISO(d),
        time: d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
        label: m.title,
        kind: kindFromEventType(m.type),
      })
    }
    for (const t of tasks) {
      if (!t.due_date) continue
      items.push({
        date: t.due_date.slice(0, 10),
        time: null,
        label: t.title,
        kind: 'task',
        href: `/admin/assignments/${t.id}`,
      })
    }
    for (const h of holidays) {
      items.push({ date: h.date, time: null, label: h.name, kind: 'holiday' })
    }
    return items
  }, [meetings, tasks, holidays])

  const itemsByDay = useMemo(() => {
    const map = new Map<number, typeof calendarItems>()
    for (const item of calendarItems) {
      const d = new Date(`${item.date}T00:00:00`)
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const day = d.getDate()
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(item)
      }
    }
    return map
  }, [calendarItems, cursor])

  const dailyAgenda = useMemo(() => {
    const dayStr = localISO(selectedDay)
    return calendarItems
      .filter((i) => i.date === dayStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  }, [calendarItems, selectedDay])

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
          {/* The eyebrow is the way into the team itself. Only on /desk:
              /admin has its own navigation, and the team page lives under
              /desk so restricted roles can actually reach it. */}
          {variant === 'desk' ? (
            <Link
              href="/desk/team"
              className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
            >
              Team Centre <ChevronRight className="w-3 h-3" />
            </Link>
          ) : (
            <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
              Team Centre
            </div>
          )}
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
              {/* Overdue isn't split by day: what matters is that it's late,
                  not which day it was due. */}
              {overdue.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Overdue</span>
                    <span className="text-[0.65rem] text-rose-600/70 dark:text-rose-400/70">{overdue.length}</span>
                  </div>
                  <div className="space-y-2">
                    {overdue.map((t) => <TaskCard key={t.id} task={t} overdue />)}
                  </div>
                </div>
              )}

              {/* One section per day work is actually due, so the list reads
                  as a schedule rather than an undifferentiated pile. */}
              {byDay.map(([day, dayTasks]) => {
                const isToday = day === todayStr
                return (
                  <div key={day}>
                    <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-[var(--color-border)]">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                        {dayHeading(day, todayStr)}
                      </span>
                      <span className="text-[0.65rem] text-[var(--color-text-muted)]">
                        {formatDate(day, 'long')}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dayTasks.map((t) => <TaskCard key={t.id} task={t} />)}
                    </div>
                  </div>
                )
              })}

              {undated.length > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-[var(--color-border)]">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">No due date</span>
                    <span className="text-[0.65rem] text-[var(--color-text-muted)]">{undated.length}</span>
                  </div>
                  <div className="space-y-2">
                    {undated.map((t) => <TaskCard key={t.id} task={t} />)}
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
                  const dayItems = day ? itemsByDay.get(day) || [] : []
                  // One dot per KIND present, not per item -- three meetings
                  // on one day is still "there are meetings", and a day with a
                  // court date plus a deadline needs to show both colours.
                  const kinds = Array.from(new Set(dayItems.map((it) => it.kind)))
                  const isHoliday = kinds.includes('holiday')
                  return (
                    <button
                      key={i}
                      disabled={!day}
                      onClick={() => day && selectDay(day)}
                      title={dayItems.map((it) => it.label).join(' · ') || undefined}
                      className={`aspect-square flex flex-col items-center justify-center text-xs border-b border-r border-[var(--color-border)]/40 last:border-r-0 hover:bg-[var(--color-surface-overlay)] transition-colors ${!day ? 'cursor-default' : ''}`}
                      style={isHoliday && !isToday ? { background: styleFor('holiday').tint } : undefined}
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
                          <span className="flex items-center gap-0.5 mt-0.5 h-1.5">
                            {kinds.slice(0, 4).map((k) => (
                              <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: styleFor(k).hex }} />
                            ))}
                          </span>
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
                  <p className="text-xs text-[var(--color-text-muted)] p-4 text-center">Nothing on this day.</p>
                ) : (
                  dailyAgenda.map((item, idx) => {
                    const s = styleFor(item.kind)
                    const row = (
                      <div className="p-3 border-l-[3px]" style={{ borderLeftColor: s.hex }}>
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-medium" style={{ background: s.tint, color: s.hex }}>
                            {s.label}
                          </span>
                          {item.time && <span>{item.time}</span>}
                        </div>
                      </div>
                    )
                    return item.href ? (
                      <Link key={idx} href={item.href} className="block hover:bg-[var(--color-surface-overlay)] transition-colors">{row}</Link>
                    ) : (
                      <div key={idx}>{row}</div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Legend: the colours are only useful if what they mean is on the
              same screen as the dots. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            {LEGEND_ORDER.map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[0.65rem] text-[var(--color-text-muted)]">
                <span className="w-2 h-2 rounded-full" style={{ background: CALENDAR_KIND_STYLES[k].hex }} />
                {CALENDAR_KIND_STYLES[k].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
