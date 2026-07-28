'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AwardItem {
  id: string
  title: string
  issuer?: string
  year?: number
  description?: string
  image_url?: string
  is_featured: boolean
}

// Year navigation over a per-year slide deck, per the UI brief: a single
// row of year labels (oldest left, most recent right) with a thin active
// underline, no heavy buttons. Clicking a year jumps straight to that
// year's awards rather than paging sequentially through everything.
//
// A firm can win several things in one year, so a year holds a deck, not a
// single slide: with one award the deck shows it plainly and no paging
// controls appear at all; with several, arrows, dots and a counter appear
// to move within that year. Selecting a different year opens that year's
// own deck from its first slide.
export default function AwardsPreview({ initialAwards }: { initialAwards: AwardItem[] }) {
  const featured = initialAwards.filter(a => a.is_featured)
  const awards = featured.length > 0 ? featured : initialAwards

  // Group by year. Anything without a year is collected under "Undated"
  // rather than silently dropped or pretending to be this year.
  const groups = awards.reduce<Record<string, AwardItem[]>>((acc, a) => {
    const key = a.year ? String(a.year) : 'Undated'
    ;(acc[key] ||= []).push(a)
    return acc
  }, {})

  // Oldest left, most recent right; "Undated" parked at the end.
  const yearKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Undated') return 1
    if (b === 'Undated') return -1
    return Number(a) - Number(b)
  })

  // Open on the most recent year, the one a visitor cares about first.
  const initialYear = yearKeys.filter(y => y !== 'Undated').pop() ?? yearKeys[0]
  const [year, setYear] = useState<string>(initialYear)
  const [slide, setSlide] = useState(0)

  if (awards.length === 0) return null

  const deck = groups[year] ?? []
  const current = deck[Math.min(slide, deck.length - 1)]
  const multiple = deck.length > 1

  function pickYear(y: string) {
    setYear(y)
    setSlide(0)
  }
  const go = (dir: 1 | -1) => setSlide(s => (s + dir + deck.length) % deck.length)

  return (
    <section className="section section-flush">
      <div className="container">
        <div className="text-center mb-10 reveal">
          <h2 className="font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            Awards &amp; Achievements
          </h2>
        </div>

        {/* Year navigation */}
        <nav className="award-years reveal" aria-label="Awards by year">
          {yearKeys.map(y => (
            <button
              key={y}
              onClick={() => pickYear(y)}
              className={`award-year ${y === year ? 'is-active' : ''}`}
              aria-current={y === year ? 'true' : undefined}
            >
              {y}
              {groups[y].length > 1 && <span className="award-year-count">{groups[y].length}</span>}
            </button>
          ))}
        </nav>

        {/* That year's deck */}
        {current && (
          <div className="award-deck reveal">
            {multiple && (
              <button onClick={() => go(-1)} className="award-deck-nav award-deck-prev" aria-label="Previous award">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <div key={current.id} className="award-slide animate-fade-in">
              {current.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.image_url} alt="" className="award-slide-badge" />
              )}
              <h3 className="award-slide-title">{current.title}</h3>
              {current.issuer && <span className="award-slide-issuer">{current.issuer}</span>}
              {current.description && <p className="award-slide-desc">{current.description}</p>}
            </div>

            {multiple && (
              <button onClick={() => go(1)} className="award-deck-nav award-deck-next" aria-label="Next award">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Within-year paging, only when the year actually holds several */}
        {multiple && (
          <div className="award-deck-dots">
            {deck.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setSlide(i)}
                className={`award-deck-dot ${i === slide ? 'is-active' : ''}`}
                aria-label={`Award ${i + 1} of ${deck.length}`}
              />
            ))}
            <span className="award-deck-counter">{slide + 1} / {deck.length}</span>
          </div>
        )}

        <div className="text-center mt-12 reveal">
          <Link href="/awards" className="btn btn-outline">View All Awards</Link>
        </div>
      </div>
    </section>
  )
}
