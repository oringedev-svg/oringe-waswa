'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2, MapPin, Clock, X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import WorkingAtOringe from '@/components/careers/WorkingAtOringe'

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
  { key: 'trainee_program', label: 'Trainee Program', blurb: 'Pupillage and graduate placements for those starting out in legal practice, structured mentorship across our core practice areas.' },
  { key: 'qualified_lawyers', label: 'Qualified Lawyers', blurb: 'Advocates and associates joining our litigation, corporate, conveyancing, and employment teams.' },
  { key: 'business_services', label: 'Business Services', blurb: 'The people who keep the firm running, finance, marketing, business development, and operations.' },
  { key: 'support_staff', label: 'Support Staff', blurb: 'Administrative, clerical, and front-office roles supporting our lawyers and clients day to day.' },
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
      <div className="py-20" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Join Us</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Careers</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">
            Whether you're starting your pupillage, an experienced advocate, or building a career in business services or support, there's a track for you here.
          </p>
        </div>
      </div>

      {/* Quick jump, mirrors the four-track + vacancy-list menu structure */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-16 z-40 overflow-x-auto">
        <div className="container flex gap-0">
          {[...TRACKS, { key: 'vacancy-list', label: 'Vacancy List' }].map(t => (
            <a key={t.key} href={`#${t.key.replace('_', '-')}`}
              className="px-5 py-4 text-sm font-medium whitespace-nowrap text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors border-b-2 border-transparent hover:border-[var(--color-accent)]">
              {t.label}
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : (
        <>
          {TRACKS.map((track, i) => {
            const items = byCategory(track.key)
            return (
              <section key={track.key} id={track.key.replace('_', '-')} className={`section ${i % 2 === 1 ? 'section-wash' : 'section-flush'}`}>
                <div className="container">
                  <div className="max-w-2xl mb-10">
                    <h2 className="font-display font-light mb-3" style={{ fontSize: 'var(--heading-section-size)' }}>{track.label}</h2>
                    <p className="text-[var(--color-text-secondary)]">{track.blurb}</p>
                  </div>

                  {items.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {items.map(job => (
                        <div key={job.id} className="card p-5">
                          <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-2">{job.title}</h3>
                          {job.summary && <p className="text-sm text-[var(--color-text-secondary)] mb-3">{job.summary}</p>}
                          <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mb-4 flex-wrap">
                            {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                            {job.employment_type && <span>{job.employment_type}</span>}
                            {job.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Apply by {formatDate(job.deadline, 'short')}</span>}
                          </div>
                          <button onClick={() => setApplyingTo({ job, category: track.key })} className="btn btn-outline text-xs">Apply Now</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card p-6 flex items-center justify-between gap-4 flex-wrap">
                      <p className="text-sm text-[var(--color-text-muted)]">No open positions in this track right now, we still welcome speculative applications.</p>
                      <button onClick={() => setApplyingTo({ category: track.key })} className="btn btn-primary text-xs flex-shrink-0">Apply Anyway</button>
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          {/* Vacancy List, every open position, regardless of track */}
          <section id="vacancy-list" className="section section-wash">
            <div className="container">
              <div className="max-w-2xl mb-10">
                <h2 className="font-display font-light mb-3" style={{ fontSize: 'var(--heading-section-size)' }}>Vacancy List</h2>
                <p className="text-[var(--color-text-secondary)]">Every current opening, in one place.</p>
              </div>
              {openings.length === 0 ? (
                <div className="card p-12 text-center text-[var(--color-muted)]">No open positions at the moment. Check back soon, or apply above for the track that fits you.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {openings.map(job => (
                    <div key={job.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{job.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mt-1 flex-wrap">
                          <span>{TRACKS.find(t => t.key === job.category)?.label}</span>
                          {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                          {job.deadline && <span>Apply by {formatDate(job.deadline, 'short')}</span>}
                        </div>
                      </div>
                      <button onClick={() => setApplyingTo({ job, category: job.category })} className="btn btn-outline text-xs flex-shrink-0">Apply Now</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Renders only once staff voices have been added in the admin. */}
          <WorkingAtOringe />
        </>
      )}

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
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
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
