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

// The standard plate for an award with no artwork of its own: an abstract
// Ankara-style geometry drawn in the firm's own palette rather than a stock
// photograph. Generated as an inline SVG so it is exactly our colours, needs
// no network request, and never looks like a placeholder someone forgot to
// replace.
//
// Deliberately abstract: concentric arcs, a dotted ground and a chevron
// band, which is the visual grammar of wax print without copying any
// specific cloth. No trophies or gavels, which would read as a stock shrug
// attached to a real recognition.
const PLATE_PALETTE = ['#a97d2f', '#8a6524', '#163d5c', '#2f6e78', '#f5f5f3']

function ankaraPlate(seed: number) {
  const [brass, brassDeep, navy, teal, cream] = PLATE_PALETTE
  // The seed only rotates which tone leads, so every award gets a plate of
  // the same family without them all being identical.
  const grounds = [navy, brassDeep, teal]
  const ground = grounds[seed % grounds.length]
  const accent = seed % 2 === 0 ? brass : teal

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
<rect width="800" height="500" fill="${ground}"/>
<g fill="none" stroke="${brass}" stroke-width="2" opacity="0.55">
${[70, 120, 170, 220, 270].map(r => `<circle cx="180" cy="250" r="${r}"/>`).join('')}
</g>
<g fill="${cream}" opacity="0.18">
${Array.from({ length: 7 }, (_, row) =>
  Array.from({ length: 11 }, (_, col) =>
    `<circle cx="${40 + col * 72}" cy="${40 + row * 70}" r="4"/>`).join('')).join('')}
</g>
<g fill="${accent}" opacity="0.9">
${Array.from({ length: 9 }, (_, i) => {
  const x = i * 100
  return `<path d="M${x} 500 L${x + 50} 430 L${x + 100} 500 Z"/>`
}).join('')}
</g>
<rect x="0" y="418" width="800" height="4" fill="${brass}" opacity="0.8"/>
<circle cx="620" cy="150" r="86" fill="none" stroke="${cream}" stroke-width="3" opacity="0.35"/>
<circle cx="620" cy="150" r="36" fill="${brass}" opacity="0.45"/>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Derived from the award's own id rather than picked at random, so a given
// award keeps the same plate on every render and between server and client.
// A random pick would change on each paint and trip hydration.
function plateFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ankaraPlate(h)
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
  // Paging controls now appear whenever there is anywhere to go at all, not
  // only when a single year holds several: with one award per year the deck
  // still advances, it just crosses into the next year to do it.
  const multiple = awards.length > 1

  function pickYear(y: string) {
    setYear(y)
    setSlide(0)
  }

  // Running off the end of a year rolls into the next one rather than
  // looping back to that year's first slide. Paging through recognition
  // should walk the whole record in order; stopping at a year boundary made
  // the reader click a year label to continue, which is navigation, not
  // reading.
  function go(dir: 1 | -1) {
    const next = slide + dir
    if (next >= 0 && next < deck.length) { setSlide(next); return }

    const yi = yearKeys.indexOf(year)
    const nextYearIdx = (yi + dir + yearKeys.length) % yearKeys.length
    const nextYear = yearKeys[nextYearIdx]
    setYear(nextYear)
    // Entering a year backwards lands on its last slide, so reversing
    // retraces the same path rather than skipping to its start.
    setSlide(dir === 1 ? 0 : Math.max((groups[nextYear]?.length ?? 1) - 1, 0))
  }

  // A solid bright gold band, the one loud surface on the site, and
  // deliberately short: recognition is a punctuation mark between the
  // longer sections either side of it, not a chapter of its own.
  return (
    <section className="award-band section-wash-faint">
      <div className="container">
        <div className="text-center mb-6 reveal">
          <h2 className="font-display award-band-title" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
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

            {/* Two panels inside one slide: the plate on the left, the
                wording on the right, so the award reads as a single object
                rather than a picture with a caption under it. */}
            <div key={current.id} className="award-slide animate-fade-in">
              <div className="award-stage">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current.image_url || plateFor(current.id)} alt="" className="award-plate" />
              </div>

              <div className="award-copy">
                {current.issuer && <span className="award-slide-issuer">{current.issuer}</span>}
                <h3 className="award-slide-title">{current.title}</h3>
                {current.description && <p className="award-slide-desc">{current.description}</p>}
              </div>
            </div>

            {multiple && (
              <button onClick={() => go(1)} className="award-deck-nav award-deck-next" aria-label="Next award">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Dots stay within-year and only appear when this year actually
            holds several. The arrows above cross years; a single dot under a
            one-award year would suggest the deck ends there when it does
            not. */}
        {deck.length > 1 && (
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

        <div className="text-center mt-7 reveal">
          <Link href="/awards" className="award-viewall">View All Awards</Link>
        </div>
      </div>
    </section>
  )
}
