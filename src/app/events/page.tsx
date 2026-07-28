'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2, ArrowUpRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Image from 'next/image'

interface Event {
  id: string
  title: string
  description?: string
  event_date?: string
  location?: string
  image_url?: string
  registration_url?: string
  status: 'upcoming' | 'past' | 'cancelled'
}

const FILTERS = ['upcoming', 'past', 'all']

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    fetch(`/api/events?${params}`)
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <PublicLayout>
      <div className="container py-16 md:py-24">
        <div className="max-w-2xl mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--color-text-primary)] mb-4">Events</h1>
          <p className="text-[var(--color-text-muted)]">Seminars, workshops, and firm events.</p>
        </div>

        <div className="flex gap-2 mb-10">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
        ) : events.length === 0 ? (
          <p className="text-[var(--color-muted)]">No events to show.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => (
              <div key={event.id} className={`photo-card photo-card--wide reveal stagger-${Math.min(i + 1, 5)}`}>
                {event.image_url ? (
                  <Image src={event.image_url} alt={event.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                ) : (
                  <div className="photo-card-fallback"><span>{event.title.charAt(0)}</span></div>
                )}

                <div className="photo-card-scrim" />

                {event.event_date && (
                  <div className="event-date-badge">
                    <span className="event-date-badge-day">{new Date(event.event_date).getDate()}</span>
                    <span className="event-date-badge-month">{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                )}

                {/* Registration is the one real action on an event, so it
                    takes the badge slot and sits above the card surface. */}
                {event.registration_url && event.status === 'upcoming' && (
                  <a
                    href={event.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="photo-card-action"
                    aria-label={`Register for ${event.title}`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}

                <div className="photo-card-body">
                  <span className="photo-card-title">{event.title}</span>
                  <span className="photo-card-eyebrow">
                    {[event.event_date && formatDate(event.event_date), event.location].filter(Boolean).join(' · ')}
                  </span>
                  <div className="photo-card-detail">
                    <div className="photo-card-detail-inner">
                      {event.description && <span className="photo-card-note line-clamp-3">{event.description}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
