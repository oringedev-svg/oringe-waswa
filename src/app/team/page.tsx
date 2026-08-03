'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import PublicLayout from '@/components/layout/PublicLayout'
import { ChevronLeft, ChevronRight, Globe2, Linkedin, Mail, Loader2, Eye } from 'lucide-react'
import MissionCallout from '@/components/layout/MissionCallout'
import Link from 'next/link'

interface TeamMember {
  id: string
  full_name: string
  position: string
  department: string
  specializations: string[]
  bio?: string
  avatar_url?: string
  bar_number?: string
  years_experience?: number
  linkedin_url?: string
  portfolio_url?: string
  education?: { degree: string; institution: string; year: number }[]
  seniority?: string
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [pupils, setPupils] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [department, setDepartment] = useState('All')
  const pupilTrackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/team?visible=true&audience=team').then(r => r.json()),
      fetch('/api/team?visible=true&audience=pupils').then(r => r.json()),
    ])
      .then(([teamData, pupilData]) => {
        setTeam(Array.isArray(teamData) ? teamData : [])
        setPupils(Array.isArray(pupilData) ? pupilData : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const departments = ['All', ...Array.from(new Set(team.map(m => m.department)))]
  const filtered = department === 'All' ? team : team.filter(m => m.department === department)
  const scrollPupils = (direction: 'back' | 'forward') => pupilTrackRef.current?.scrollBy({ left: direction === 'forward' ? 360 : -360, behavior: 'smooth' })

  return (
    <PublicLayout>
      <div className="team-editorial-intro py-20" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Our People</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Meet the Team</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">
            Experienced advocates, solicitors, and legal professionals dedicated to delivering exceptional outcomes for our clients.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : team.length === 0 ? (
            <div className="text-center py-20 text-[var(--color-text-muted)]">Team information coming soon.</div>
          ) : (
            <div className="flex flex-col md:flex-row items-start gap-10">
              {/* Sidebar department filter, vertical list with counts, sticky */}
              {departments.length > 2 && (
                <aside className="w-full md:w-56 flex-shrink-0 md:sticky md:top-24">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-3">Department</h4>
                  <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                    {departments.map(dep => {
                      const count = dep === 'All' ? team.length : team.filter(m => m.department === dep).length
                      const active = department === dep
                      return (
                        <button
                          key={dep}
                          onClick={() => setDepartment(dep)}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left whitespace-nowrap md:whitespace-normal rounded-sm border transition-colors flex-shrink-0"
                          style={{
                            background: active ? 'var(--color-text-primary)' : 'transparent',
                            color: active ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                            borderColor: active ? 'var(--color-text-primary)' : 'var(--color-border)',
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          <span className="flex-1">{dep}</span>
                          {dep !== 'All' && <span className="opacity-70 text-xs flex-shrink-0">({count})</span>}
                        </button>
                      )
                    })}
                  </div>
                </aside>
              )}

              {/* Card grid */}
              <div className="flex-1 min-w-0 w-full">
                {filtered.length === 0 ? (
                  <div className="text-center py-20 text-[var(--color-text-muted)]">No team members in this department.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((member, idx) => (
                      <div key={member.id} className={`photo-card reveal stagger-${Math.min(idx % 4 + 1, 4)}`}>
                        {member.avatar_url ? (
                          <Image src={member.avatar_url} alt={member.full_name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                        ) : (
                          <div className="photo-card-fallback"><span>{member.full_name.charAt(0)}</span></div>
                        )}

                        <div className="photo-card-scrim" />

                        {/* Opening the bio is the card's main action here, so
                            the whole surface triggers it rather than a small
                            "Read Bio" link buried under the fold. */}
                        <Link href={`/team/${member.id}`} className="photo-card-hit" aria-label={`View profile for ${member.full_name}`} />

                        {(member.linkedin_url || member.portfolio_url) && <div className="photo-card-actions">
                          {member.linkedin_url && <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" className="photo-card-action" aria-label={`${member.full_name} on LinkedIn`}><Linkedin className="w-3.5 h-3.5" /></a>}
                          {member.portfolio_url && <a href={member.portfolio_url} target="_blank" rel="noopener noreferrer" className="photo-card-action" aria-label={`View ${member.full_name}'s portfolio`}><Globe2 className="w-3.5 h-3.5" /></a>}
                        </div>}

                        <div className="photo-card-body">
                          <span className="photo-card-title">{member.full_name}</span>
                          <span className="photo-card-eyebrow">{member.position}</span>
                          <div className="photo-card-detail">
                            <div className="photo-card-detail-inner">
                              <span className="photo-card-note">
                                {[member.department, member.years_experience ? `${member.years_experience} years experience` : null].filter(Boolean).join(' · ')}
                              </span>
                              {member.specializations?.length > 0 && (
                                <div className="photo-card-tags">
                                  {member.specializations.slice(0, 3).map(s => (
                                    <span key={s} className="photo-card-tag">{s}</span>
                                  ))}
                                </div>
                              )}
                              {member.bio && (
                                <span className="photo-card-note inline-flex items-center gap-1.5">
                                  <Eye className="w-3.5 h-3.5" /> View profile
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!loading && pupils.length > 0 && (
        <section className="pupils-showcase section">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-5 mb-8">
              <div>
                <span className="eyebrow mb-4 block">The next generation</span>
                <h2 className="font-display text-3xl sm:text-4xl font-light text-[var(--color-text-primary)]">Legal Trainees</h2>
                <p className="mt-3 max-w-xl text-[var(--color-text-muted)]">Meet the legal trainees gaining practical experience under the guidance of our team.</p>
              </div>
              {pupils.length > 1 && <div className="flex gap-2" aria-label="Pupil carousel controls">
                <button type="button" onClick={() => scrollPupils('back')} className="pupil-slider-control" aria-label="Previous pupils"><ChevronLeft className="w-5 h-5" /></button>
                <button type="button" onClick={() => scrollPupils('forward')} className="pupil-slider-control" aria-label="Next pupils"><ChevronRight className="w-5 h-5" /></button>
              </div>}
            </div>
            <div ref={pupilTrackRef} className="pupil-slider-track" aria-label="Legal trainees">
              {pupils.map(member => <article key={member.id} className="photo-card pupil-slide">
                {member.avatar_url ? <Image src={member.avatar_url} alt={member.full_name} fill sizes="(max-width: 640px) 85vw, 22rem" className="object-cover" /> : <div className="photo-card-fallback"><span>{member.full_name.charAt(0)}</span></div>}
                <div className="photo-card-scrim" />
                <Link href={`/team/${member.id}`} className="photo-card-hit" aria-label={`View profile for ${member.full_name}`} />
                {(member.linkedin_url || member.portfolio_url) && <div className="photo-card-actions">
                  {member.linkedin_url && <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" className="photo-card-action" aria-label={`${member.full_name} on LinkedIn`}><Linkedin className="w-3.5 h-3.5" /></a>}
                  {member.portfolio_url && <a href={member.portfolio_url} target="_blank" rel="noopener noreferrer" className="photo-card-action" aria-label={`View ${member.full_name}'s portfolio`}><Globe2 className="w-3.5 h-3.5" /></a>}
                </div>}
                <div className="photo-card-body">
                  <span className="photo-card-title">{member.full_name}</span>
                  <span className="photo-card-eyebrow">{member.position || 'Legal Trainee'}</span>
                  <div className="photo-card-detail"><div className="photo-card-detail-inner">
                    <span className="photo-card-note">Legal Trainee</span>
                    {member.specializations?.length > 0 && <div className="photo-card-tags">{member.specializations.slice(0, 3).map(s => <span key={s} className="photo-card-tag">{s}</span>)}</div>}
                    <span className="photo-card-note inline-flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> View profile</span>
                  </div></div>
                </div>
              </article>)}
            </div>
          </div>
        </section>
      )}

      <MissionCallout
        eyebrow="Work with our people"
        title="The right team changes the outcome."
        description="Meet the advocates and professionals behind our work, then tell us where you need clear, dependable advice."
        primaryHref="/appointments"
        primaryLabel="Book a consultation"
        secondaryHref="/careers"
        secondaryLabel="Join the team"
      />

      {/* Member detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-[var(--shadow-xl)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="relative h-48 bg-[var(--color-surface-overlay)]">
              {selected.avatar_url
                ? <Image src={selected.avatar_url} alt={selected.full_name} fill className="object-cover object-top" />
                : <div className="w-full h-full flex items-center justify-center"><span className="font-display text-6xl text-[var(--color-accent)]/20">{selected.full_name.charAt(0)}</span></div>
              }
              <div className="absolute bottom-0 left-0 right-0 h-16" style={{ background: 'linear-gradient(transparent, rgba(20,18,14,0.55))' }} />
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors text-lg leading-none">×</button>
            </div>
            <div className="p-6">
              <h2 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{selected.full_name}</h2>
              <p className="text-sm text-[var(--color-accent)] font-medium tracking-wide uppercase mt-1 mb-1">{selected.position}</p>
              <p className="text-sm text-[var(--color-muted)] mb-4">{selected.department}</p>

              {selected.bio && <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">{selected.bio}</p>}

              {selected.specializations?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Specializations</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.specializations.map(s => (
                      <span key={s} className="text-xs px-3 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {(selected.education?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Education</p>
                  {selected.education!.map((e, i) => (
                    <div key={i} className="text-sm text-[var(--color-text-secondary)]">
                      {e.degree}, {e.institution} ({e.year})
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {selected.linkedin_url && (
                  <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline gap-2 text-sm">
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                )}
                <a href="/appointments" className="btn btn-primary gap-2 text-sm flex-1 justify-center">
                  <Mail className="w-4 h-4" /> Book Consultation
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  )
}
