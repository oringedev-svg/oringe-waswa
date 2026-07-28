import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface Group {
  id: string
  name: string
  slug: string
  description?: string
  image_url?: string
}

// Practice groups rather than nineteen individual areas, an image-led grid
// (borrowed from Elite Designs' services grid: full-bleed photo, title and
// blurb over it, a "Learn more" link) reads as a firm's breadth without
// the clutter a flat list of that many items would create. Each card links
// into the Capabilities page filtered to that group. No client-side fetch
// here any more, groups arrive server-fetched from the homepage.
export default function ServicesSection({ initialGroups }: { initialGroups: Group[] }) {
  const groups = initialGroups

  if (groups.length === 0) return null

  return (
    <section className="section">
      <div className="container">
        <div className="text-center mb-14 reveal">
          <h2 className="font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            What We Practice
          </h2>
        </div>

        <div className="capability-grid">
          {groups.map((g, i) => (
            <Link
              key={g.id}
              href={`/services#${g.slug}`}
              className={`photo-card capability-tile reveal stagger-${Math.min(i + 1, 5)} ${i === 0 ? 'capability-tile-lead' : ''}`}
            >
              {g.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image_url} alt="" />
              ) : (
                <div className="photo-card-fallback"><span>{g.name.charAt(0)}</span></div>
              )}
              <div className="photo-card-scrim" />
              <div className="photo-card-body">
                <span className="photo-card-title">{g.name}</span>
                {g.description && <span className="photo-card-note">{g.description}</span>}
                <span className="capability-tile-link">
                  Learn more <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}

          {/* The CTA fills the empty cells the grid leaves in its last row
              rather than floating a small button beneath it: a bold coloured
              panel that is itself a giant arrow. */}
          <Link href="/services" className="capability-cta reveal">
            <span className="capability-cta-label">View all capabilities</span>
            <ArrowRight className="capability-cta-arrow" strokeWidth={1.25} />
          </Link>
        </div>
      </div>
    </section>
  )
}
