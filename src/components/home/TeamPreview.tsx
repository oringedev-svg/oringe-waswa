import Link from 'next/link'
import Image from 'next/image'
import { Linkedin } from 'lucide-react'

interface TeamMember {
  id: string
  full_name: string
  position: string
  department: string
  avatar_url?: string
  specializations: string[]
  linkedin_url?: string
}

// No client-side fetch here any more, team members arrive server-fetched
// from the homepage.
export default function TeamPreview({ initialTeam }: { initialTeam: TeamMember[] }) {
  const team = initialTeam.slice(0, 4)

  const placeholders = [
    { full_name: 'Oringe Waswa', position: 'Senior Partner', department: 'Litigation', specializations: ['Civil Litigation', 'Criminal Defense'] },
    { full_name: 'Associate Partner', position: 'Partner', department: 'Corporate', specializations: ['Corporate Law', 'M&A'] },
    { full_name: 'Senior Associate', position: 'Senior Associate', department: 'Family Law', specializations: ['Family Law', 'Property'] },
    { full_name: 'Legal Associate', position: 'Associate', department: 'Immigration', specializations: ['Immigration', 'Employment'] },
  ]

  const displayTeam = team.length > 0 ? team : placeholders

  return (
    <section className="section section-flush section-tint-sage">
      <div className="container">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <h2 className="reveal font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300, letterSpacing: '-0.02em' }}>
              Meet Our Team
            </h2>
            <div className="grow-line-left rule-accent mt-5" />
          </div>
          <Link href="/team" className="btn btn-outline flex-shrink-0">View All Attorneys</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayTeam.map((member, i) => {
            const m = member as TeamMember
            return (
              <div key={m.id || i} className={`photo-card reveal stagger-${Math.min(i + 1, 5)}`}>
                {m.avatar_url ? (
                  <Image src={m.avatar_url} alt={member.full_name} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
                ) : (
                  <div className="photo-card-fallback">
                    <span>{member.full_name.charAt(0)}</span>
                  </div>
                )}

                <div className="photo-card-scrim" />

                <Link href="/team" className="photo-card-hit" aria-label={`${member.full_name}, ${member.position}`} />

                {m.linkedin_url && (
                  <a
                    href={m.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="photo-card-action"
                    aria-label={`${member.full_name} on LinkedIn`}
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                )}

                <div className="photo-card-body">
                  <span className="photo-card-title">{member.full_name}</span>
                  <span className="photo-card-eyebrow">{member.position}</span>
                  <div className="photo-card-detail">
                    <div className="photo-card-detail-inner">
                      <span className="photo-card-note">{member.department}</span>
                      {member.specializations?.length > 0 && (
                        <div className="photo-card-tags">
                          {member.specializations.slice(0, 3).map(s => (
                            <span key={s} className="photo-card-tag">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
