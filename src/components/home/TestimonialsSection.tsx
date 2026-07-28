'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'

// Clients are shown by initials rather than full name. Legal work is
// sensitive by default, and a testimonial should not be the thing that
// puts a named person alongside a description of their matter. The full
// name stays in the admin record; only the initials are published.
function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts.slice(0, 3).map((p) => `${p[0].toUpperCase()}.`).join('')
}

interface Testimonial {
  id: string
  client_name: string
  client_role?: string
  quote: string
  avatar_url?: string
}

// No client-side fetch here any more, testimonials arrive server-fetched
// (and already filtered to client praise, staff voices live on the Careers
// page) from the homepage. The carousel state itself is still client-side.
export default function TestimonialsSection({ initialTestimonials }: { initialTestimonials: Testimonial[] }) {
  const testimonials = initialTestimonials
  const [index, setIndex] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!autoPlaying || testimonials.length <= 1) return
    intervalRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % testimonials.length)
    }, 6000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoPlaying, testimonials.length])

  if (testimonials.length === 0) return null

  const current = testimonials[index]

  const goTo = (i: number) => { setIndex(i); setAutoPlaying(false) }
  const next = () => goTo((index + 1) % testimonials.length)
  const prev = () => goTo((index - 1 + testimonials.length) % testimonials.length)

  return (
    <section className="section section-wash seam-fade">
      <div className="container">
        <div className="text-center mb-14">
          <h2 className="reveal font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>What Clients Say</h2>
          <div className="grow-line rule-accent mx-auto mt-5" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {testimonials.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous testimonial"
                className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-[calc(50%+2px)] transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--color-text-primary)]" />
              </button>
              <button
                onClick={next}
                aria-label="Next testimonial"
                className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-12 h-12 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-[calc(50%+2px)] transition-all"
              >
                <ChevronRight className="w-5 h-5 text-[var(--color-text-primary)]" />
              </button>
            </>
          )}

          <div
            key={current.id}
            className="animate-fade-in flex flex-col md:flex-row overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
          >
            {/* Portrait / initial panel */}
            <div className="relative w-full md:w-2/5 h-56 md:h-auto flex-shrink-0 bg-[var(--color-surface-overlay)]">
              {current.avatar_url ? (
                <Image src={current.avatar_url} alt={toInitials(current.client_name)} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-display italic text-7xl text-[var(--color-accent)]/40">{current.client_name.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Quote panel */}
            <div className="flex-1 flex flex-col justify-center p-8 md:p-12 gap-6">
              <span className="font-display text-6xl leading-none text-[var(--color-accent)]/25" aria-hidden="true">&rdquo;</span>
              <blockquote className="text-lg leading-relaxed text-[var(--color-text-secondary)]" style={{ fontStyle: 'italic' }}>
                &ldquo;{current.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-5 border-t border-[var(--color-border)]">
                <div>
                  <div className="font-display font-semibold text-[var(--color-text-primary)]">{toInitials(current.client_name)}</div>
                  {current.client_role && <div className="text-xs text-[var(--color-muted)] mt-0.5">{current.client_role}</div>}
                </div>
              </div>
            </div>
          </div>

          {testimonials.length > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <div className="flex items-center gap-2">
                {testimonials.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => goTo(i)}
                    aria-label={`Go to testimonial ${i + 1}`}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === index ? '22px' : '8px',
                      background: i === index ? 'var(--color-accent)' : 'var(--color-border)',
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => setAutoPlaying(p => !p)}
                aria-label={autoPlaying ? 'Pause autoplay' : 'Resume autoplay'}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors ml-2"
              >
                {autoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
