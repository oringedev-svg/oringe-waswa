'use client'
import { useState, useEffect, useRef, Fragment } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Menu, X, Sun, Moon, ChevronDown, Search, Twitter, Instagram, Linkedin, Youtube, Facebook, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import TranslateWidget from '@/components/ui/TranslateWidget'
import { useSetting } from '@/components/providers/SiteSettingsProvider'
import type { NavMenuItem } from '@/lib/settingsSchema'

const DEFAULT_NAV_LINKS: NavMenuItem[] = [
  { label: 'Capabilities', href: '/services', hasSubmenu: true },
  { label: 'Team', href: '/team' },
  { label: 'Impact', href: '/impact' },
  { label: 'Insights', href: '/insights' },
  { label: 'Careers', href: '/careers', hasSubmenu: true },
  { label: 'Contact', href: '/contact' },
]

// Careers' dropdown is a fixed set of tracks (not fetched from an API, unlike
// Services' practice areas), the same five-way split ALN's Careers menu
// uses: four candidate tracks plus the standing Vacancy List.
const CAREERS_SUBMENU = [
  { href: '/careers#trainee-program', label: 'Trainee Program' },
  { href: '/careers#qualified-lawyers', label: 'Qualified Lawyers' },
  { href: '/careers#business-services', label: 'Business Services' },
  { href: '/careers#support-staff', label: 'Support Staff' },
  { href: '/careers#vacancy-list', label: 'Vacancy List' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  // The server cannot know the visitor's stored theme, so it always renders
  // the Moon icon; a client booting in dark mode renders Sun, and React
  // flags the mismatch on every dark-mode load. Render the icon only after
  // mount so server and first client render agree.
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => { setThemeReady(true) }, [])
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [submenuItems, setSubmenuItems] = useState<{ href: string; label: string }[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScrollY = useRef(0)

  // Debounced open/close so moving the mouse from the trigger down into the
  // panel, which sits lower than the trigger, past a visual gap, doesn't
  // register as "left the menu" and slam it shut before you get there.
  function openDropdown(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActiveDropdown(label)
  }
  function scheduleCloseDropdown() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setActiveDropdown(null), 250)
  }

  // Hides on scroll-down, reappears the moment the user scrolls back up,
  // stays visible near the top regardless of direction, so it never
  // vanishes right as the page loads or on a tiny scroll jitter.
  useEffect(() => {
    lastScrollY.current = window.scrollY
    const handler = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      if (y < 100) setHidden(false)
      else if (y > lastScrollY.current + 4) setHidden(true)
      else if (y < lastScrollY.current - 4) setHidden(false)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => { setOpen(false); setSearchOpen(false); setActiveDropdown(null) }, [pathname])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`/blog?search=${encodeURIComponent(q)}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  useEffect(() => {
    fetch('/api/practice-areas')
      .then(r => r.json())
      .then(d => setSubmenuItems(Array.isArray(d) ? d.map((a: { title: string; slug: string }) => ({ label: a.title, href: `/services#${a.slug}` })) : []))
      .catch(() => {})
  }, [])

  const firmName = useSetting<string>('firm_name', 'Oringe Waswa & Akude Advocates LLP')
  const logoUrl = useSetting<string>('firm_logo_url', '')
  const navLinks = useSetting<NavMenuItem[]>('nav_main_links', DEFAULT_NAV_LINKS)
    .map((link) => {
      if (!link.hasSubmenu) return { ...link, children: undefined }
      if (link.label === 'Careers') return { ...link, children: CAREERS_SUBMENU }
      return { ...link, children: submenuItems }
    })

  // Long firm name → a two-line lockup split at "Advocates", plus an initials
  // monogram (e.g. "OWA") built from the leading name words. No uploaded logo
  // needed; the monogram stands in until one is set in Site Settings.
  const advMatch = firmName.search(/\bAdvocates?\b/i)
  const namePart1 = advMatch > -1 ? firmName.slice(0, advMatch).trim() : firmName
  const namePart2 = advMatch > -1 ? firmName.slice(advMatch).trim() : ''
  const monogram = namePart1
    .replace(/&|\band\b/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'OW'

  // Social icons are shown only for the channels the firm has configured
  // under Website → Site Settings → Social Media.
  const socials = [
    { icon: Twitter, url: useSetting<string>('social_x', ''), label: 'X' },
    { icon: Instagram, url: useSetting<string>('social_instagram', ''), label: 'Instagram' },
    { icon: Linkedin, url: useSetting<string>('social_linkedin', ''), label: 'LinkedIn' },
    { icon: Youtube, url: useSetting<string>('social_youtube', ''), label: 'YouTube' },
    { icon: Facebook, url: useSetting<string>('social_facebook', ''), label: 'Facebook' },
  ].filter((s) => s.url)

  // The homepage opens on a full-bleed dark hero with the nav floating on
  // top of it, so until the user scrolls past it, nav text needs to be
  // light rather than the usual dark-on-light styling.
  const onDarkHero = pathname === '/' && !scrolled

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-[var(--color-surface)]/95 backdrop-blur-md shadow-[var(--shadow-md)]' : 'bg-transparent',
      hidden && !open && !activeDropdown ? '-translate-y-full' : 'translate-y-0'
    )}>
      <div className="container">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="flex items-center justify-center transition-transform group-hover:scale-105 overflow-hidden flex-shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={firmName} className="h-9 w-auto object-contain" />
              ) : (
                <span className={cn('font-display font-semibold text-xl tracking-tight leading-none', onDarkHero ? 'text-[#f5f5f3]' : 'text-[var(--color-ink)]')}>{monogram}</span>
              )}
            </div>
            <div className="leading-tight">
              <div className={cn('font-display font-semibold text-[15px] leading-tight tracking-tight', onDarkHero ? 'text-[#f5f5f3]' : 'text-[var(--color-text-primary)]')}>{namePart1}</div>
              {namePart2 && <div className={cn('text-[10px] tracking-[0.22em] uppercase mt-0.5', onDarkHero ? 'text-[#f5f5f3]/55' : 'text-[var(--color-muted)]')}>{namePart2}</div>}
            </div>
          </Link>

          {/* Right cluster: nav links, socials, then utilities (search,
              language, theme) last, then the CTA. */}
          <div className="hidden lg:flex items-center gap-5">
            {/* Nav links, | separated */}
            <div className="flex items-center gap-4">
              {navLinks.map((link, i) => {
                const linkColor = onDarkHero ? 'text-[#f5f5f3]/85 hover:text-[#f5f5f3]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]'
                const activeColor = onDarkHero ? 'text-[var(--color-accent-light)]' : 'text-[var(--color-accent)]'
                return (
                  <Fragment key={link.label}>
                    {i > 0 && (
                      <span className={cn('text-xs select-none', onDarkHero ? 'text-[#f5f5f3]/25' : 'text-[var(--color-border)]')}>|</span>
                    )}
                    {link.children && link.children.length > 0 ? (
                      // Services → full-width mega-menu on hover. Open/close is
                      // debounced (see openDropdown/scheduleCloseDropdown) so
                      // crossing the gap between the trigger and the panel
                      // below it doesn't close the menu before you get there.
                      <div onMouseEnter={() => openDropdown(link.label)} onMouseLeave={scheduleCloseDropdown}>
                        <button className={cn('flex items-center gap-1 py-2 text-[13px] font-medium tracking-tight transition-colors', activeDropdown === link.label ? activeColor : linkColor)}>
                          {link.label}
                          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', activeDropdown === link.label && 'rotate-180')} />
                        </button>
                        {activeDropdown === link.label && (
                          <div
                            onMouseEnter={() => openDropdown(link.label)}
                            onMouseLeave={scheduleCloseDropdown}
                            className="fixed left-0 right-0 top-16 md:top-20 z-40 animate-slide-down bg-[var(--color-surface)] border-t border-b border-[var(--color-border)] shadow-[var(--shadow-lg)]">
                            <div className="container py-14 grid grid-cols-12 gap-x-12 gap-y-8">
                              <div className="col-span-12 md:col-span-4 lg:col-span-3 md:pr-8 md:border-r md:border-[var(--color-border)]">
                                <div className="grow-line-left rule-accent mb-5 visible" />
                                <h3 className="font-display text-2xl font-light text-[var(--color-text-primary)]">{link.label}</h3>
                                <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-xs">
                                  {link.label === 'Careers'
                                    ? "Trainee to qualified lawyer, business services to support staff, see where you'd fit."
                                    : 'Full-service counsel across our core practice areas, tailored to the outcome you need.'}
                                </p>
                                <Link href={link.href || '/services'} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] hover:underline mt-6">
                                  {link.label === 'Careers' ? 'View all openings' : 'View all capabilities'} <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                              <div className="col-span-12 md:col-span-8 lg:col-span-9 grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                                {link.children.map((child) => (
                                  <Link key={child.href} href={child.href}
                                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-overlay)] transition-colors leading-snug rounded-md px-3 py-3">
                                    {child.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link href={link.href!}
                        className={cn('py-2 text-[13px] font-medium tracking-tight transition-colors', pathname === link.href ? activeColor : linkColor)}>
                        {link.label}
                      </Link>
                    )}
                  </Fragment>
                )
              })}
            </div>

            {socials.length > 0 && (
              <div className="flex items-center gap-3">
                {socials.map(({ icon: Icon, url, label }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer" title={label}
                    className={cn('transition-colors', onDarkHero ? 'text-[#f5f5f3]/70 hover:text-[#f5f5f3]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]')}>
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}

            {/* Divider before the utility trio */}
            <span className={cn('h-5 w-px', onDarkHero ? 'bg-[#f5f5f3]/25' : 'bg-[var(--color-border)]')} />

            {/* Utilities: search, language, theme, last before the CTA */}
            <div className="flex items-center gap-3">
              {searchOpen ? (
                <form onSubmit={submitSearch} className="flex items-center">
                  <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => !searchQuery && setSearchOpen(false)}
                    placeholder="Search…"
                    className={cn('w-36 bg-transparent border-b text-sm py-1 outline-none transition-colors',
                      onDarkHero ? 'border-[#f5f5f3]/40 text-[#f5f5f3] placeholder:text-[#f5f5f3]/40' : 'border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-muted)]')} />
                </form>
              ) : (
                <button onClick={() => setSearchOpen(true)} title="Search"
                  className={cn('transition-colors', onDarkHero ? 'text-[#f5f5f3]/85 hover:text-[#f5f5f3]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]')}>
                  <Search className="w-4 h-4" />
                </button>
              )}
              <TranslateWidget />
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn('transition-colors', onDarkHero ? 'text-[#f5f5f3]/85 hover:text-[#f5f5f3]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]')} title="Toggle theme">
                {themeReady && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            <Link href="/appointments" className={cn('btn text-xs', onDarkHero ? 'border border-[#f5f5f3]/40 text-[#f5f5f3] hover:border-[var(--color-accent-light)]' : 'btn-primary')}>Book Appointment</Link>
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 lg:hidden">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn('btn btn-ghost p-2 !px-2', onDarkHero && 'text-[#f5f5f3]/80 hover:text-[#f5f5f3] hover:bg-white/10')} title="Toggle theme">
              {themeReady && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className={cn('btn btn-ghost p-2 !px-2', onDarkHero && 'text-[#f5f5f3]/80 hover:text-[#f5f5f3] hover:bg-white/10')} onClick={() => setOpen(!open)}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] animate-slide-down">
          <div className="container py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <div key={link.label}>
                <Link href={link.href || '#'}
                  className={cn('block px-4 py-3 text-sm font-medium rounded-md transition-colors',
                    pathname === link.href
                      ? 'bg-[var(--color-surface-overlay)] text-[var(--color-accent)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]')}>
                  {link.label}
                </Link>
                {link.children && link.children.length > 0 && (
                  <div className="ml-4 flex flex-col gap-0.5 mt-0.5">
                    {link.children.map((child) => (
                      <Link key={child.href} href={child.href}
                        className="block px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors rounded-md hover:bg-[var(--color-surface-overlay)]">
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <form onSubmit={submitSearch} className="flex items-center gap-2 px-4 py-2 mt-1">
              <Search className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search…"
                className="flex-1 bg-transparent border-b border-[var(--color-border)] text-sm py-1 outline-none" />
            </form>
            <Link href="/appointments" className="btn btn-primary mt-2 text-center">Book Appointment</Link>
            {socials.length > 0 && (
              <div className="flex items-center gap-4 px-4 mt-3">
                {socials.map(({ icon: Icon, url, label }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer" title={label}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-2 px-2"><TranslateWidget /></div>
          </div>
        </div>
      )}
    </nav>
  )
}
