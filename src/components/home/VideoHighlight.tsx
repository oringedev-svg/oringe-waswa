'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Play } from 'lucide-react'
import { useSetting } from '@/components/providers/SiteSettingsProvider'

// The firm has no highlight reel yet, so rather than putting a play button
// on stock footage and promising a video that does not exist, the band runs
// as a still image with a "See our impact" panel over it, reusing the same
// giant-arrow CTA treatment as "View all capabilities". The moment a real
// video URL is set in Site Settings, it becomes a genuine click-to-play
// video instead, no code change needed.
export default function VideoHighlight() {
  const url = useSetting<string>('home_video_url', '')
  const poster = useSetting<string>('home_video_poster', '')
  const title = useSetting<string>('home_video_title', 'How we work with our clients')
  const impactHref = useSetting<string>('home_video_impact_link', '/case-results')

  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // A real video was configured: click to play, nothing streams until asked.
  const hasVideo = Boolean(url)

  function play() {
    setPlaying(true)
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}))
  }

  return (
    <section className="section section-tint-slate video-band">
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
      </div>
    </section>
  )
}
