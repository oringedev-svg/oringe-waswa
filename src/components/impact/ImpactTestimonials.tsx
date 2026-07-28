'use client'
import Image from 'next/image'

// Clients are shown by initials rather than full name, the same rule the
// homepage carousel used: legal work is sensitive by default, and a
// testimonial should not be the thing that puts a named person next to a
// description of their matter. The full name stays in the admin record.
function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return parts.slice(0, 3).map(p => `${p[0].toUpperCase()}.`).join('')
}

interface Testimonial {
  id: string
  client_name: string
  client_role?: string
  quote: string
  avatar_url?: string
}

// A full grid rather than the homepage's one-at-a-time carousel. On a page
// someone opened specifically to weigh the firm up, showing everything at
// once respects that intent more than making them page through.
export default function ImpactTestimonials({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <div className="impact-quote-grid">
      {testimonials.map((t, i) => (
        <figure key={t.id} className={`impact-quote reveal stagger-${Math.min(i + 1, 5)}`}>
          <blockquote className="impact-quote-text">{t.quote}</blockquote>
          <figcaption className="impact-quote-person">
            {t.avatar_url ? (
              <Image src={t.avatar_url} alt="" width={36} height={36} className="impact-quote-avatar" />
            ) : (
              <span className="impact-quote-avatar impact-quote-avatar-fallback">
                {t.client_name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="impact-quote-name">{toInitials(t.client_name)}</span>
              {t.client_role && <span className="impact-quote-role">{t.client_role}</span>}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
