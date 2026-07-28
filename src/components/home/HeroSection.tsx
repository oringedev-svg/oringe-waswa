'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Linkedin, Facebook, Instagram, Twitter, Youtube, ArrowRight } from 'lucide-react'
import { useSetting } from '@/components/providers/SiteSettingsProvider'

const DEFAULT_TITLE = 'Strong legal support guiding your matters with clarity'

// Hardcoded fallback so the hero always has a photo even if the settings
// pipeline (site_settings -> /api/settings/public) isn't reflecting the
// admin's uploaded choice yet. The settings value, once it does come
// through, still takes priority over this.
const DEFAULT_HERO_IMAGE = 'https://jtzyttgkyztyfogryqvq.supabase.co/storage/v1/object/public/gallery/gallery/1784808821407-hero-dark-architectural.png'
// A cinematic video background, used in place of the still photo when
// available. Falls back to the image (then the flat fallback) for
// reduced-motion users or if the video can't load.
const DEFAULT_HERO_VIDEO = '/hero-video.mp4'

const SOCIAL_ICONS = [
  { key: 'social_linkedin', Icon: Linkedin, label: 'LinkedIn' },
  { key: 'social_x', Icon: Twitter, label: 'X' },
  { key: 'social_facebook', Icon: Facebook, label: 'Facebook' },
  { key: 'social_instagram', Icon: Instagram, label: 'Instagram' },
  { key: 'social_youtube', Icon: Youtube, label: 'YouTube' },
] as const

export default function HeroSection() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const mediaRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const heroVideo = useSetting<string>('home_hero_video_url', '') || DEFAULT_HERO_VIDEO
  const heroImage = useSetting<string>('home_hero_image_url', '') || DEFAULT_HERO_IMAGE
  const firmName = useSetting<string>('firm_name', 'Oringe Waswa & Akude Advocates LLP')
  const heroTitle = useSetting<string>('home_hero_title', DEFAULT_TITLE)
  const ctaText = useSetting<string>('home_hero_cta_text', 'Speak to a Lawyer')
  const ctaLink = useSetting<string>('home_hero_cta_link', '/appointments')

  const linkedin = useSetting<string>('social_linkedin', '')
  const x = useSetting<string>('social_x', '')
  const facebook = useSetting<string>('social_facebook', '')
  const instagram = useSetting<string>('social_instagram', '')
  const youtube = useSetting<string>('social_youtube', '')
  const socialUrls: Record<string, string> = { social_linkedin: linkedin, social_x: x, social_facebook: facebook, social_instagram: instagram, social_youtube: youtube }
  const activeSocials = SOCIAL_ICONS.filter(s => socialUrls[s.key])

  // Split the firm name so the entity suffix (Advocates LLP, & Co, etc.) can
  // carry the orange highlight while the rest writes in plain, reads as a
  // deliberate lockup rather than one flat line, whatever the name is.
  const words = firmName.trim().split(/\s+/)
  const highlightCount = words.length > 2 ? 2 : 1
  const plainWords = words.slice(0, -highlightCount).join(' ')
  const highlightWords = words.slice(-highlightCount).join(' ')

  // Gentle parallax, the photo drifts slower than the page scrolls, the
  // same "pinned" feel Giara's hero has, without position:fixed's mobile
  // quirks. Skipped entirely for reduced-motion users. No-ops when the
  // video background is active since mediaRef isn't attached to it.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        if (mediaRef.current && y < window.innerHeight * 1.2) {
          mediaRef.current.style.transform = `translateY(${y * 0.25}px) scale(1.08)`
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  return (
    <section className="hero-full">
      {heroVideo && !reducedMotion ? (
        <>
          <video
            autoPlay muted loop playsInline preload="auto"
            className="hero-full-media"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          <div className="hero-full-scrim" />
        </>
      ) : heroImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={mediaRef} src={heroImage} alt="" className="hero-full-media" style={{ transform: 'scale(1.08)', willChange: 'transform' }} />
          <div className="hero-full-scrim" />
        </>
      ) : (
        <div className="hero-full-fallback" />
      )}

      <div className="hero-full-content hero-full-content-center">
        <div>
          <span className="hero-name-eyebrow">Advocates &middot; Commissioners for Oaths &middot; Notaries Public</span>
          <h1 className="hero-name-reveal">
            <span className="hero-name-reveal-wipe">
              {plainWords ? `${plainWords} ` : ''}
              <span className="hero-name-highlight">{highlightWords}</span>
            </span>
          </h1>
        </div>
      </div>

      <div className="hero-full-content hero-full-bottom-row">
        <h2 className="hero-full-statement">{heroTitle}</h2>
        <Link href={ctaLink} className="hero-btn-outline gap-2 flex-shrink-0">
          <ArrowRight className="w-4 h-4" /> {ctaText}
        </Link>
      </div>

      {activeSocials.length > 0 && (
        <div className="hero-full-footbar hero-full-footbar-end">
          <div className="flex items-center gap-4">
            <span className="font-mono tracking-[0.14em] uppercase text-[0.68rem]" style={{ color: 'rgba(245,245,243,.5)' }}>Follow</span>
            <div className="flex items-center gap-3">
              {activeSocials.map(({ key, Icon, label }) => (
                <a key={key} href={socialUrls[key]} target="_blank" rel="noopener noreferrer" aria-label={label}
                  style={{ color: 'rgba(245,245,243,.68)' }} className="hover:opacity-70 transition-opacity">
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
