'use client'
import { useEffect, useRef, useState } from 'react'
import { useSetting } from '@/components/providers/SiteSettingsProvider'

// Scroll-pinned statement band on the neutral gray surface (gray in both
// themes): the section holds in place while the visitor scrolls through
// three slides, two statements and then the numbers. A single HORIZONTAL
// line along the bottom grows a third per slide, surfacing one metric at
// its tip each time, so by the final slide the full line carries all three
// metrics together. 70vh of scroll per slide rather than the original
// 100vh, which is what made the earlier pinned version feel stuck.

interface StatItem { label: string; value: number; suffix: string }

const STATEMENTS = [
  {
    id: 's1',
    text: 'We understand that every legal challenge is unique. We listen, advise, and deliver solutions that protect what matters most to our clients.',
  },
  {
    id: 's2',
    text: 'We have built a proven track record of decisive outcomes for the clients who trust us.',
  },
]

const DEFAULT_STATS: StatItem[] = [
  { value: 2500, suffix: '++', label: 'Solved Cases' },
  { value: 9, suffix: '', label: 'Practice Areas' },
  { value: 15, suffix: '+', label: 'Years of Practice' },
]

// Counts up the first time its point on the line is reached. No "already
// started" ref guard: under React Strict Mode the mount effect runs, its
// cleanup clears the interval, and the rerun would then see the ref already
// set and skip, leaving the figure stuck at 0. The deps themselves only
// ever change once (run flips false to true and stays there), so the
// effect re-running is exactly the run-once behaviour wanted.
function Counter({ target, suffix, run }: { target: number; suffix: string; run: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!run) return
    const steps = 40
    let current = 0
    const timer = setInterval(() => {
      current += target / steps
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 1000 / steps)
    return () => clearInterval(timer)
  }, [run, target])

  return <span>{count.toLocaleString()}{suffix}</span>
}

export default function ServiceSpotlight() {
  // One metric per slide, so exactly three are drawn from the setting.
  const stats = useSetting<StatItem[]>('home_stats', DEFAULT_STATS).slice(0, 3)
  const [active, setActive] = useState(0)
  const wrapperRef = useRef<HTMLElement>(null)

  const totalSlides = STATEMENTS.length + 1
  const isFinal = active === totalSlides - 1
  const lineProgress = (active + 1) / totalSlides

  useEffect(() => {
    // Reduced motion: no pinned scroll choreography, just show the finished
    // state, full line, all three metrics.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActive(totalSlides - 1)
      return
    }
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = wrapperRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        if (total <= 0) return
        const progress = Math.min(Math.max(-rect.top / total, 0), 1)
        setActive(Math.min(Math.floor(progress * totalSlides), totalSlides - 1))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [totalSlides])

  return (
    <section ref={wrapperRef} className="spotlight-pin section-flush" style={{ height: `${totalSlides * 70}vh` }}>
      <div className="spotlight-pin-inner spotlight-band">
        <div className="band-accent-shape" aria-hidden="true" />
        <div className="container text-center relative z-10">

          {/* Slides share one grid cell so nothing shifts as they crossfade. */}
          <div className="spotlight-slider">
            {STATEMENTS.map((s, i) => (
              <p
                key={s.id}
                className={`spotlight-statement spotlight-slide ${i === active ? 'is-active' : ''}`}
                aria-hidden={i !== active}
              >
                {s.text}
              </p>
            ))}
            <p
              className={`spotlight-finale spotlight-slide ${isFinal ? 'is-active' : ''}`}
              aria-hidden={!isFinal}
            >
              Our impact, in numbers
            </p>
          </div>

          {/* The horizontal line: the teal fill grows a third per slide,
              and as it reaches each metric an outlined square draws itself
              around it, an SVG rect whose stroke animates via dashoffset.
              Boxes sit at the CENTRE of each third so the growing fill
              always passes through the square it just completed. */}
          <div className="spotlight-line" aria-hidden={false}>
            <span className="spotlight-line-track" />
            <span className="spotlight-line-fill" style={{ width: `${lineProgress * 100}%` }} />
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`spotlight-line-stat ${active >= i ? 'is-on' : ''}`}
                style={{ left: `${((i * 2 + 1) / (stats.length * 2)) * 100}%` }}
              >
                <svg className="spotlight-line-box" viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true">
                  <rect x="1" y="1" width="98" height="54" pathLength={100} />
                </svg>
                <span className="spotlight-line-value">
                  <Counter target={s.value} suffix={s.suffix} run={active >= i} />
                </span>
                <span className="spotlight-line-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
