'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Loader2 } from 'lucide-react'

interface Group {
  id: string
  name: string
  slug: string
  description?: string
}

interface PracticeArea {
  id: string
  slug: string
  title: string
  description?: string
  short_description?: string
  highlights?: string[]
  image_url?: string
  group?: { id: string; name: string; slug: string } | null
}

export default function ServicesPage() {
  const [services, setServices] = useState<PracticeArea[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/practice-areas').then(r => r.json()),
      fetch('/api/practice-area-groups').then(r => r.json()).catch(() => []),
    ]).then(([a, g]) => {
      setServices(Array.isArray(a) ? a : [])
      setGroups(Array.isArray(g) ? g : [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Smooth scroll for anchor links
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement
      if (anchor) {
        e.preventDefault()
        const id = anchor.getAttribute('href')!.slice(1)
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const filtered = activeGroup ? services.filter(s => s.group?.slug === activeGroup) : services
  const ungroupedCount = services.filter(s => !s.group).length

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="relative py-24 overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="hero-abstract">
          <div className="hero-orb hero-orb-1" style={{ opacity: 0.5 }} />
          <div className="hero-grid" style={{ opacity: 0.5 }} />
        </div>
        <div className="container relative z-10">
          <span className="eyebrow mb-4 block">Capabilities</span>
          <h1 className="font-display font-light mb-4 reveal" style={{ fontSize: 'var(--heading-page-size)' }}>
            What We Practice
          </h1>
          <p className="text-[var(--color-text-muted)] max-w-xl reveal stagger-1">
            Comprehensive legal expertise across all major practice areas, delivered by experienced advocates and solicitors committed to your success.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : (
            <>
              {/* Group sidebar + directory grid, borrowed from Bird & Bird's
                  Capabilities page: a category list on the left picks what
                  the grid of boxes on the right shows. */}
              <div className="services-directory">
                <nav className="services-sidebar" aria-label="Practice groups">
                  <button
                    onClick={() => setActiveGroup(null)}
                    className={`services-sidebar-item ${activeGroup === null ? 'is-active' : ''}`}
                  >
                    All Capabilities
                  </button>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => setActiveGroup(g.slug)}
                      className={`services-sidebar-item ${activeGroup === g.slug ? 'is-active' : ''}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </nav>

                <div className="services-box-grid">
                  {filtered.map(s => (
                    <a key={s.id} href={`#${s.slug}`} className="services-box">
                      {s.title}
                      <ArrowUpRight className="w-4 h-4 flex-shrink-0" />
                    </a>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-sm text-[var(--color-muted)] py-8">Nothing in this group yet.</p>
                  )}
                  {activeGroup === null && ungroupedCount > 0 && (
                    <p className="text-xs text-[var(--color-muted)] mt-2 col-span-full">
                      {ungroupedCount} {ungroupedCount === 1 ? 'area is' : 'areas are'} not yet assigned to a group in the admin.
                    </p>
                  )}
                </div>
              </div>

              {/* Full detail per area, unchanged alternating layout,
                  filtered to whichever group is selected above. */}
              <div className="flex flex-col gap-20 mt-24">
                {filtered.map(({ id, slug, image_url, title, description, highlights }, i) => (
                  <div key={id} id={slug} className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center scroll-mt-24 ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                    <div className={`reveal ${i % 2 !== 0 ? 'reveal-right lg:order-last' : 'reveal-left'}`}>
                      <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                        {image_url && <Image src={image_url} alt={title} fill className="object-cover" style={{ filter: 'var(--site-photo-filter)' }} />}
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(16,17,19,.85) 100%)' }} />
                        <span className="absolute bottom-5 left-6 font-display text-6xl font-light text-white/70">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    <div className={`reveal ${i % 2 !== 0 ? 'reveal-left' : 'reveal-right'}`}>
                      <h2 className="font-display font-semibold mb-4" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
                        {title}
                      </h2>
                      <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6">
                        {description}
                      </p>

                      {highlights && highlights.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-3">Key Services</p>
                          <div className="flex flex-wrap gap-2">
                            {highlights.map(h => (
                              <span key={h}
                                className="text-sm px-3 py-1.5 rounded-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-default">
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <Link href="/appointments" className="btn btn-primary gap-2 text-sm">
                        Consult an Attorney <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CTA */}
          <div className="mt-24 text-center card p-12 reveal-scale">
            <h2 className="font-display text-3xl font-light text-[var(--color-text-primary)] mb-4">
              Not Sure Which Service You Need?
            </h2>
            <p className="text-[var(--color-text-muted)] mb-8 max-w-xl mx-auto">
              Book a free initial consultation. Our AI assistant will help route you to the right attorney.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/appointments" className="btn btn-primary gap-2 px-8 py-4">
                Book a Free Consultation <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact" className="btn btn-outline gap-2 px-8 py-4">
                Chat with AI Assistant
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
