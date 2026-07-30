'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import { useSetting } from '@/components/providers/SiteSettingsProvider'

// THE CASE RECORD STRIP.
//
// One dark blue band carrying three things that used to be three separate
// sections: the film still, the firm's proof figures, and the cases won.
// The figures came from the pinned statement band above and the cases from
// a row of tall poster cards below; both said "here is the evidence", so
// they now sit in one strip with the still, the figures closing its top
// half and the cases filling the bottom.
//
// The firm has no highlight reel yet, so the still runs as an image with a
// "See our impact" panel over it. The moment a real video URL is set in
// Site Settings it becomes a genuine click-to-play video, no code change.

interface CaseResult {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  client_type?: string
  year?: number
  image_url?: string
}

interface StatItem { label: string; value: number; suffix: string }

const DEFAULT_STATS: StatItem[] = [
  { value: 2500, suffix: '+', label: 'Cases Resolved' },
  { value: 9, suffix: '', label: 'Practice Areas' },
  { value: 15, suffix: '+', label: 'Years of Impact' },
]

// Legal-centric stand-ins for cases with no image of their own: a courtroom
// bench, bound law reports, a signing. Subject matter that belongs to the
// work rather than generic office stock.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1436450412740-6b988f486c6b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=600&q=80',
]

// Counts up once the band is reached. No "already ran" ref: under React
// Strict Mode the mount effect runs, its cleanup clears the interval, and a
// ref guard would make the rerun skip and leave the figure at zero.
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

export default function VideoHighlight({ caseResults = [] }: { caseResults?: CaseResult[] }) {
  const url = useSetting<string>('home_video_url', '')
  const poster = useSetting<string>('home_video_poster', '')
  const title = useSetting<string>('home_video_title', 'How we work with our clients')
  const impactHref = useSetting<string>('home_video_impact_link', '/case-results')
  const stats = useSetting<StatItem[]>('home_stats', DEFAULT_STATS).slice(0, 3)

  const [playing, setPlaying] = useState(false)
  const [entered, setEntered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bandRef = useRef<HTMLElement>(null)

  const hasVideo = Boolean(url)
  const cases = caseResults.slice(0, 3)

  // Figures only animate once the band is actually on screen. Reduced-motion
  // skips straight to the final value rather than counting.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEntered(true)
      return
    }
    const el = bandRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setEntered(true); io.disconnect() } },
      { rootMargin: '-10% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function play() {
    setPlaying(true)
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}))
  }

  return (
    <section ref={bandRef} className="section section-tint-slate video-band">
      <div className="container">
        <div className="max-w-3xl mb-10 reveal">
          <h2 className="font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
            {title}
          </h2>
        </div>

        <div className="video-highlight reveal">
          {hasVideo ? (
            <>
              <video
                ref={videoRef}
                className="video-highlight-media"
                src={url}
                poster={poster || undefined}
                playsInline
                preload="metadata"
                controls={playing}
                onEnded={() => setPlaying(false)}
              />
              {!playing && (
                <button className="video-highlight-cover" onClick={play} aria-label={`Play video: ${title}`}>
                  <span className="video-highlight-scrim" />
                  <span className="video-highlight-play"><Play className="w-6 h-6" /></span>
                </button>
              )}
            </>
          ) : (
            <>
              {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="video-highlight-media" src={poster} alt="" />
              )}
              <span className="video-highlight-scrim" />
              <Link href={impactHref} className="video-impact-cta">
                <span className="video-impact-label">See our impact</span>
                <ArrowRight className="video-impact-arrow" strokeWidth={1.25} />
              </Link>
            </>
          )}
        </div>

        {/* The figures, closing the still. */}
        <dl className="strip-figures reveal">
          {stats.map(s => (
            <div key={s.label} className="strip-figure">
              <dt className="strip-figure-value">
                <Counter target={s.value} suffix={s.suffix} run={entered} />
              </dt>
              <dd className="strip-figure-label">{s.label}</dd>
            </div>
          ))}
        </dl>

        {/* Cases won, only when there are any to show. */}
        {cases.length > 0 && (
          <>
            <div className="strip-heading reveal">
              <span className="strip-heading-label">Cases Won</span>
              <span className="strip-heading-rule" aria-hidden="true" />
            </div>

            {/* Column count comes from the data, so two cases read as a
                deliberate pair rather than leaving an empty third cell. */}
            <div className="case-strip" style={{ '--case-count': cases.length } as React.CSSProperties}>
              {cases.map((r, i) => (
                <Link key={r.id} href="/impact" className={`case-mini reveal stagger-${Math.min(i + 1, 5)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="case-mini-media"
                    src={r.image_url || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                    alt=""
                  />
                  <span className="case-mini-body">
                    <span className="case-mini-title">{r.title}</span>
                    <span className="case-mini-outcome">{r.outcome}</span>
                    {(r.practice_area || r.year) && (
                      <span className="case-mini-meta">
                        {[r.practice_area, r.year].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>

            <div className="reveal">
              <Link href="/impact" className="strip-viewall">
                See All Cases <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
