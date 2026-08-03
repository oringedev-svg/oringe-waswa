'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Globe2, Linkedin, Loader2, MapPin } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'

type Person = { id: string; full_name: string; position: string; department: string; specializations: string[]; bio?: string; avatar_url?: string; bar_number?: string; years_experience?: number; linkedin_url?: string; portfolio_url?: string; education?: { degree: string; institution: string; year?: number }[] }

export default function TeamMemberPage({ params }: { params: { id: string } }) {
  const [person, setPerson] = useState<Person | null>(null)
  const [notFound, setNotFound] = useState(false)
  useEffect(() => { fetch(`/api/team/${params.id}`).then(async r => { if (!r.ok) { setNotFound(true); return null }; return r.json() }).then(data => data && setPerson(data)).catch(() => setNotFound(true)) }, [params.id])

  if (notFound) return <PublicLayout><div className="container py-32 text-center"><h1 className="font-display text-3xl">Profile not found</h1><Link className="btn btn-outline mt-6" href="/team">Back to the team</Link></div></PublicLayout>
  if (!person) return <PublicLayout><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div></PublicLayout>

  return <PublicLayout fullBleedTop>
    <section className="person-profile-hero">
      <div className="person-profile-photo">
        {person.avatar_url ? <Image src={person.avatar_url} alt={person.full_name} fill priority sizes="(max-width: 900px) 100vw, 50vw" className="object-cover object-top" /> : <div className="person-profile-fallback">{person.full_name.charAt(0)}</div>}
      </div>
      <div className="person-profile-identity"><div className="person-profile-identity-inner"><Link href="/team" className="person-profile-back"><ArrowLeft className="w-4 h-4" /> Our people</Link><span className="eyebrow">{person.department || 'Oringe Waswa & Akude'}</span><h1>{person.full_name}</h1><p className="person-profile-role">{person.position}</p><div className="person-profile-meta">{person.years_experience ? <span><BriefcaseBusiness className="w-4 h-4" /> {person.years_experience} years&apos; experience</span> : null}{person.bar_number ? <span><MapPin className="w-4 h-4" /> Advocate of the High Court</span> : null}</div><div className="person-profile-actions"><Link href="/appointments" className="person-profile-primary"><CalendarDays className="w-4 h-4" /> Book a consultation</Link>{person.linkedin_url && <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" className="person-profile-secondary"><Linkedin className="w-4 h-4" /> LinkedIn</a>}{person.portfolio_url && <a href={person.portfolio_url} target="_blank" rel="noopener noreferrer" className="person-profile-secondary"><Globe2 className="w-4 h-4" /> Portfolio</a>}</div></div></div>
    </section>
    <section className="section person-profile-body"><div className="container person-profile-grid"><aside className="person-profile-nav"><a href="#about">About</a><a href="#experience">Experience</a><a href="#capabilities">Capabilities</a>{person.education?.length ? <a href="#education">Education</a> : null}</aside><div className="person-profile-content"><article id="about"><h2>About {person.full_name.split(' ')[0]}</h2><p>{person.bio || `${person.full_name} is part of our ${person.department || 'legal'} team, supporting clients with clear, commercially grounded advice.`}</p></article><article id="experience"><h2>Experience</h2><p>{person.years_experience ? `With ${person.years_experience} years of experience, ${person.full_name.split(' ')[0]} brings focused legal judgment and practical perspective to each instruction.` : 'Experience details are available on request.'}</p></article><article id="capabilities"><h2>Capabilities</h2><div className="person-profile-capabilities">{(person.specializations || []).map(area => <span key={area}>{area}</span>)}{!person.specializations?.length && <span>Legal advisory</span>}</div></article>{person.education?.length ? <article id="education"><h2>Education</h2><div className="person-profile-education">{person.education.map((item, index) => <div key={index}><strong>{item.degree}</strong><span>{item.institution}{item.year ? ` · ${item.year}` : ''}</span></div>)}</div></article> : null}</div></div></section>
  </PublicLayout>
}
