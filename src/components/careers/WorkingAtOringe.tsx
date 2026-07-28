'use client'
import { useEffect, useState } from 'react'

// Feedback from the people who actually work here, not client praise. Kept
// on the Careers page because its only job is to answer "what is it like to
// work at this firm" for someone deciding whether to apply.
//
// Renders nothing at all when no staff voices have been added, rather than
// showing an empty heading.
interface StaffVoice {
  id: string
  client_name: string      // the person's name
  client_role?: string     // their position at the firm
  quote: string
  avatar_url?: string
  years_at_firm?: string
}

export default function WorkingAtOringe() {
  const [voices, setVoices] = useState<StaffVoice[]>([])

  useEffect(() => {
    fetch('/api/testimonials?kind=staff')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setVoices(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  if (voices.length === 0) return null

  return (
    <section id="working-at-oringe" className="section section-tint-sage scroll-mt-24">
      <div className="container">
        <div className="max-w-2xl mb-14">
          <span className="eyebrow mb-4 block">Working at Oringe</span>
          <h2 className="font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            In their own words
          </h2>
          <p className="mt-4 text-[var(--color-text-muted)]">
            What the people who build their careers here say about the work, the people, and what the firm expects of them.
          </p>
        </div>

        <div className="staff-voices">
          {voices.map((v, i) => (
            <figure key={v.id} className={`staff-voice reveal stagger-${Math.min(i + 1, 5)}`}>
              <blockquote className="staff-voice-quote">{v.quote}</blockquote>
              <figcaption className="staff-voice-person">
                {v.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.avatar_url} alt="" className="staff-voice-avatar" />
                ) : (
                  <span className="staff-voice-avatar staff-voice-avatar-fallback">{v.client_name.charAt(0)}</span>
                )}
                <span className="min-w-0">
                  <span className="staff-voice-name">{v.client_name}</span>
                  <span className="staff-voice-role">
                    {[v.client_role, v.years_at_firm].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
