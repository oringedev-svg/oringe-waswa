'use client'
import { useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Video, MapPin, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function PortalCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Mock events for the client
  const events = [
    { id: 1, title: 'Initial Consultation', date: '2026-08-05T10:00:00Z', duration: '1 hour', type: 'video', location: 'Google Meet', matter: 'OW-2026-001' },
    { id: 2, title: 'Document Signing', date: '2026-08-12T14:30:00Z', duration: '30 mins', type: 'in-person', location: 'Firm Office, Nairobi', matter: 'OW-2026-001' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
            Schedule
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Calendar & Meetings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-overlay)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold w-32 text-center">August 2026</span>
          <button className="p-2 border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-overlay)] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Simple mock calendar grid */}
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)]">
            <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-overlay)]/40 text-center text-xs font-semibold py-3 text-[var(--color-text-muted)]">
              <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
            </div>
            <div className="grid grid-cols-7 auto-rows-[100px] divide-y divide-x divide-[var(--color-border)]/50">
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i - 5 // offset to start August
                const isCurrentMonth = day > 0 && day <= 31
                const isToday = day === 4 // Assuming today is Aug 4
                const dayEvents = events.filter(e => new Date(e.date).getDate() === day && isCurrentMonth)

                return (
                  <div key={i} className={`p-1.5 ${!isCurrentMonth ? 'bg-[var(--color-surface-overlay)]/30' : ''}`}>
                    <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)]'}`}>
                      {isCurrentMonth ? day : ''}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map(e => (
                        <div key={e.id} className="text-[10px] leading-tight p-1 bg-[var(--color-brand)]/10 text-[var(--color-brand)] border border-[var(--color-brand)]/20 rounded truncate cursor-pointer hover:bg-[var(--color-brand)]/20">
                          {new Date(e.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} {e.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-overlay)]/40 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">Upcoming Meetings</h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {events.map(event => (
                <div key={event.id} className="p-4 hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">{event.title}</h4>
                    <span className="text-[0.65rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)] border border-[var(--color-border)]">{event.matter}</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-accent)]" />
                      {formatDate(event.date, 'long')} · {event.duration}
                    </div>
                    <div className="flex items-center gap-2">
                      {event.type === 'video' ? <Video className="w-3.5 h-3.5 flex-shrink-0 text-sky-500" /> : <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />}
                      {event.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
