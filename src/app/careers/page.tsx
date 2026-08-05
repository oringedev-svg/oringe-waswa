'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2, X, CheckCircle, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import WorkingAtOringe from '@/components/careers/WorkingAtOringe'
import MissionCallout from '@/components/layout/MissionCallout'

interface JobOpening {
  id: string
  title: string
  category: string
  location?: string
  employment_type?: string
  summary?: string
  description?: string
  requirements?: string
  deadline?: string
}

// The five-way split mirrors a Careers menu structure worth borrowing
// directly: four tracks a candidate self-identifies into, plus a standing
// Vacancy List that rolls every open position up in one place regardless
// of track.
const TRACKS = [
  { key: 'trainee_program', label: 'Trainee Program', image: '/images/ai/ai_img_8.png' },
  { key: 'qualified_lawyers', label: 'Qualified Lawyers', image: '/images/ai/ai_img_1.png' },
  { key: 'business_services', label: 'Business Services', image: '/images/ai/ai_img_3.png' },
  { key: 'support_staff', label: 'Support Staff', image: '/images/ai/ai_img_7.png' },
] as const

export default function CareersPage() {
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingTo, setApplyingTo] = useState<{ job?: JobOpening; category: string } | null>(null)

  useEffect(() => {
    fetch('/api/careers')
      .then(r => r.json())
      .then(d => setOpenings(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const byCategory = (cat: string) => openings.filter(o => o.category === cat)

  return (
    <PublicLayout>
      <div className="relative pt-32 pb-40 lg:pt-48 lg:pb-56 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
          alt="Careers at Oringe Waswa"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative container text-center max-w-4xl mx-auto z-10 text-white">
          <span className="text-xs uppercase tracking-[0.2em] font-semibold mb-6 block text-white/80">Careers</span>
          <h1 className="font-display text-5xl lg:text-7xl font-light leading-tight mb-6">
            Grow With Us.
          </h1>
          <p className="text-xl text-white/80 leading-relaxed font-light">
            Whether you're starting your pupillage, an experienced advocate, or building a career in business services, there's a track for you here.
          </p>
        </div>
      </div>

      <section className="section bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-center">
             <div>
               <h2 className="font-display text-3xl lg:text-5xl font-light mb-8">A Culture of Excellence.</h2>
               <p className="text-[var(--color-text-secondary)] leading-relaxed mb-6 text-lg">
                 At Oringe Waswa, we believe that delivering exceptional legal services requires an environment where talent can thrive. We invest heavily in mentorship, continuous learning, and creating a collaborative culture that challenges and supports you.
               </p>
               <p className="text-[var(--color-text-secondary)] leading-relaxed text-lg">
                 Our firm is built on the strength of our people. From our rigorous trainee program to our dedicated business services teams, every role is critical to our success and the success of our clients.
               </p>
             </div>
             <div className="relative aspect-[4/3] w-full bg-[var(--color-surface-overlay)]">
                <Image
                  src="https://images.unsplash.com/photo-1573164713988-8665fc963095?ixlib=rb-4.0.3&auto=format&fit=crop&w=1469&q=80"
                  alt="Culture"
                  fill
                  className="object-cover"
                />
             </div>
          </div>
        </div>
      </section>

      <section className="section bg-[var(--color-surface-wash)] border-b border-[var(--color-border)]">
        <div className="container max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)] font-semibold mb-4 block">Tracks</span>
            <h2 className="font-display font-light text-4xl lg:text-5xl mb-4 text-[var(--color-text-primary)]">Find Your Place</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRACKS.map(track => (
              <a key={track.key} href="#vacancies" onClick={(e) => { e.preventDefault(); setApplyingTo({ category: track.key }); }} className="group relative h-[28rem] flex items-end p-8 overflow-hidden bg-[var(--color-surface-overlay)]">
                <Image src={track.image} alt={track.label} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
                <div className="relative z-10 w-full">
                  <h3 className="font-display text-2xl mb-2 text-white">{track.label}</h3>
                  <div className="mt-6 flex items-center text-xs uppercase tracking-[0.1em] font-semibold text-white/80 group-hover:text-white transition-colors">
                    Speculative Apply <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="vacancies" className="section bg-[var(--color-surface)]">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="font-display font-light text-4xl lg:text-5xl mb-4 text-[var(--color-text-primary)]">Current Opportunities</h2>
          </div>
          
          <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)]">
             {loading ? (
                <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
             ) : openings.length === 0 ? (
                <div className="p-16 text-center text-[var(--color-text-muted)]">
                   No open positions at the moment. Please select a track above to submit a speculative application.
                </div>
             ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-[0.15em] text-[var(--color-muted)]">
                      <tr>
                        <th className="px-8 py-6 font-semibold">Position</th>
                        <th className="px-8 py-6 font-semibold">Track</th>
                        <th className="px-8 py-6 font-semibold hidden md:table-cell">Location</th>
                        <th className="px-8 py-6 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)] border-t border-[var(--color-border)]">
                      {openings.map(job => (
                        <tr key={job.id} className="hover:bg-[var(--color-surface)] transition-colors group">
                          <td className="px-8 py-6 font-medium text-base">{job.title}</td>
                          <td className="px-8 py-6 text-[var(--color-text-secondary)]">{TRACKS.find(t => t.key === job.category)?.label}</td>
                          <td className="px-8 py-6 text-[var(--color-text-secondary)] hidden md:table-cell">{job.location || 'Nairobi, KE'}</td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => setApplyingTo({ job, category: job.category })} className="text-[var(--color-accent)] font-semibold uppercase tracking-[0.1em] text-xs inline-flex items-center gap-1.5 transition-opacity">Apply <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
        </div>
      </section>

      <WorkingAtOringe />
      <MissionCallout
        eyebrow="Build your practice with us"
        title="See your work make a difference."
        description="Join a team that pairs rigorous legal work with practical service to people, businesses and institutions across Kenya."
        primaryHref="#vacancies"
        primaryLabel="Explore open positions"
      />

      {applyingTo && <ApplyModal target={applyingTo} onClose={() => setApplyingTo(null)} />}
    </PublicLayout>
  )
}

function ApplyModal({ target, onClose }: { target: { job?: JobOpening; category: string }; onClose: () => void }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '', resume_url: '' })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const trackLabel = TRACKS.find(t => t.key === target.category)?.label || target.category

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name || !form.email) { toast.error('Name and email are required'); return }
    setSubmitting(true)
    try {
      let resume_file_url: string | undefined
      let resume_file_name: string | undefined

      if (resumeFile) {
        setUploadingResume(true)
        const fd = new FormData()
        fd.append('file', resumeFile)
        const uploadRes = await fetch('/api/careers/resume-upload', { method: 'POST', body: fd })
        setUploadingResume(false)
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          toast.error(err.error || 'Could not upload the resume'); setSubmitting(false); return
        }
        const uploaded = await uploadRes.json()
        resume_file_url = uploaded.url
        resume_file_name = uploaded.file_name
      }

      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, resume_file_url, resume_file_name, category: target.category, job_id: target.job?.id }),
      })
      if (res.ok) setDone(true)
      else toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{done ? 'Application sent' : 'Apply'}</h2>
          <button onClick={onClose} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
        </div>
        {!done && (
          <p className="text-sm text-[var(--color-text-muted)] mb-5">{target.job ? target.job.title : trackLabel}</p>
        )}

        {done ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <CheckCircle className="w-10 h-10 text-green-600" />
            <p className="text-sm text-[var(--color-text-secondary)]">We've received your application and sent you a confirmation email. We'll be in touch if there's a fit.</p>
            <button onClick={onClose} className="btn btn-primary mt-2">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <label className="label">Full Name *</label>
              <input className="input text-sm" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Resume / CV</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="input text-sm"
                onChange={e => setResumeFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">PDF or Word, up to 5MB. Optional, but strongly recommended.</p>
            </div>
            <div>
              <label className="label">Or a link instead (Drive, LinkedIn, portfolio)</label>
              <input className="input text-sm" placeholder="https://…" value={form.resume_url} onChange={e => setForm({ ...form, resume_url: e.target.value })} />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea rows={3} className="input text-sm" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            </div>
            <button type="submit" disabled={submitting} className="btn btn-primary mt-2 gap-2 justify-center">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {uploadingResume ? 'Uploading resume…' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
