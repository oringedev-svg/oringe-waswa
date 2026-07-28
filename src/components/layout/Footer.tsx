'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Phone, Facebook, Twitter, Linkedin, Instagram, Youtube, ArrowUp, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import TranslateWidget from '@/components/ui/TranslateWidget'
import { useSetting } from '@/components/providers/SiteSettingsProvider'
import type { FooterLinkItem } from '@/lib/settingsSchema'

interface FooterLink { label: string; url: string }

// No "Home" entry, the wordmark link above already goes there. Blog folds
// under Insights as one public-facing concept (they remain separate content
// engines internally; /blog/[slug] permalinks still work).
const DEFAULT_FOOTER_COLUMNS: FooterLinkItem[][] = [
  [
    { href: '/team', label: 'Team' },
    { href: '/insights', label: 'Insights' },
    { href: '/awards', label: 'Awards' },
  ],
  [
    { href: '/services', label: 'Capabilities' },
    { href: '/services#family-law', label: 'Family Law' },
    { href: '/services#corporate', label: 'Corporate Law' },
  ],
  [
    { href: '/events', label: 'Events' },
    { href: '/resources', label: 'Client Resources' },
  ],
  [
    { href: '/contact', label: 'Contact' },
    { href: '/appointments', label: 'Book Appointment' },
    { href: '/track', label: 'Track Submission' },
  ],
]

const COLUMN_HEADERS = ['Firm', 'Capabilities', 'Resources', 'Get In Touch', 'Connect']

// The consultation CTA and mail signup used to be their own full-height
// homepage section; they now open the footer instead, so every page ends
// with the same quiet ask. The rest is deliberately sparse: small type,
// hairline dividers that draw themselves in on scroll, and whitespace
// doing the separating that boxes and headers used to do.
export default function Footer() {
  const firmName = useSetting<string>('firm_name', 'Oringe Waswa & Akude Advocates LLP')
  const footerCopyright = useSetting<string>('footer_copyright', 'All rights reserved. | Advocates LLP')
  const footerLinks = useSetting<FooterLink[]>('footer_links', [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' },
    { label: 'Disclaimer', url: '/disclaimer' },
  ])
  const phones = useSetting<string[]>('contact_phones', ['+254 700 000 000'])
  const linkColumns = useSetting<FooterLinkItem[][]>('footer_nav_columns', DEFAULT_FOOTER_COLUMNS)
  const ctaTitle = useSetting<string>('home_cta_title', 'Ready to Discuss Your Legal Matter?')
  const ctaPrimaryLabel = useSetting<string>('home_cta_primary_label', 'Book a Consultation')
  const ctaPrimaryLink = useSetting<string>('home_cta_primary_link', '/appointments')
  const ctaSecondaryLabel = useSetting<string>('home_cta_secondary_label', 'Contact Us')
  const ctaSecondaryLink = useSetting<string>('home_cta_secondary_link', '/contact')
  const socials = [
    { url: useSetting<string>('social_facebook', ''), Icon: Facebook },
    { url: useSetting<string>('social_x', ''), Icon: Twitter },
    { url: useSetting<string>('social_linkedin', ''), Icon: Linkedin },
    { url: useSetting<string>('social_instagram', ''), Icon: Instagram },
    { url: useSetting<string>('social_youtube', ''), Icon: Youtube },
  ].filter((s) => s.url)

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSending(true)
    try {
      const res = await fetch('/api/mail/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) { setDone(true); toast.success('Subscribed') }
      else toast.error('Subscription failed. Please try again.')
    } catch {
      toast.error('Network error. Please try again.')
    } finally { setSending(false) }
  }

  return (
    <footer className="footer-ink">
      <div className="container">

        {/* The ask, folded in from the old homepage CTA section. */}
        <div className="footer-cta">
          <h2 className="footer-cta-title">{ctaTitle}</h2>
          <div className="footer-cta-actions">
            <Link href={ctaPrimaryLink} className="hero-btn-solid">{ctaPrimaryLabel}</Link>
            <Link href={ctaSecondaryLink} className="hero-btn-outline">{ctaSecondaryLabel}</Link>
          </div>
        </div>

        <div className="footer-rule grow-line" />

        {/* Mail signup, one quiet row. */}
        <div className="footer-mail" id="newsletter">
          {done ? (
            <span className="footer-mail-note inline-flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" /> Subscribed, check your email.
            </span>
          ) : (
            <>
              <span className="footer-mail-note">One brief a month, the legal developments worth knowing.</span>
              <form onSubmit={subscribe} className="footer-mail-form">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                  className="footer-mail-input"
                />
                <button type="submit" disabled={sending} className="footer-mail-submit">
                  {sending ? '…' : 'Subscribe'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="footer-rule grow-line" />

        {/* Navigation, small and airy. */}
        <div className="footer-columns">
          {linkColumns.map((col, i) => (
            <div key={i} className="flex flex-col gap-3">
              <span className="footer-col-header">{COLUMN_HEADERS[i] || ''}</span>
              <ul className="flex flex-col gap-2.5">
                {col.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="footer-link">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col gap-4">
            <span className="footer-col-header">{COLUMN_HEADERS[linkColumns.length] || 'Connect'}</span>
            {socials.length > 0 && (
              <div className="flex gap-3">
                {socials.map(({ Icon, url }, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="footer-social-icon w-7 h-7 rounded-sm flex items-center justify-center">
                    <Icon className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
            {phones[0] && (
              <a href={`tel:${phones[0].replace(/\s+/g, '')}`} className="footer-link inline-flex items-center gap-2">
                <Phone className="w-3 h-3 flex-shrink-0" />
                {phones[0]}
              </a>
            )}
            <div className="max-w-[160px]">
              <TranslateWidget onDark />
            </div>
          </div>
        </div>

        <div className="footer-rule grow-line" />

        {/* Bottom bar */}
        <div className="footer-bottom-bar">
          <Link href="/" className="footer-wordmark">{firmName}</Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {footerLinks.map((item) => (
              <Link key={item.label} href={item.url} className="footer-legal-link">{item.label}</Link>
            ))}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="footer-legal-link inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
            >
              Top <ArrowUp className="w-3 h-3" />
            </button>
          </div>
          <p className="footer-legal-link">
            © {new Date().getFullYear()} {firmName}. {footerCopyright}
          </p>
        </div>
      </div>
    </footer>
  )
}
