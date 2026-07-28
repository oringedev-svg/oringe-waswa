'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, ArchiveRestore, MapPin, Briefcase, Users2, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate, getStatusColor } from '@/lib/utils'

interface JobOpening {
  id: string
  title: string
  category: 'trainee_program' | 'qualified_lawyers' | 'business_services' | 'support_staff'
  location?: string
  employment_type?: string
  summary?: string
  description?: string
  requirements?: string
  deadline?: string
  is_open: boolean
}

interface JobApplication {
  id: string
  job_id: string | null
  category: string
  full_name: string
  email: string
  phone?: string
  message?: string
  resume_url?: string
  status: string
  created_at: string
  job_openings?: { title: string } | null
}

const CATEGORIES: { value: JobOpening['category']; label: string }[] = [
  { value: 'trainee_program', label: 'Trainee Program' },
  { value: 'qualified_lawyers', label: 'Qualified Lawyers' },
  { value: 'business_services', label: 'Business Services' },
  { value: 'support_staff', label: 'Support Staff' },
]
const categoryLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v
const APP_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired']

export default function AdminCareersPage() {
  const [tab, setTab] = useState<'openings' | 'applications'>('openings')

  // Openings
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [loadingOpenings, setLoadingOpenings] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<JobOpening> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  // Applications
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loadingApps, setLoadingApps] = useState(true)

  function loadOpenings() {
    setLoadingOpenings(true)
    const params = new URLSearchParams({ all: 'true' })
    if (trash) params.set('trash', 'true')
    fetch(`/api/careers?${params}`)
      .then(r => r.json())
      .then(d => setOpenings(Array.isArray(d) ? d : []))
      .finally(() => setLoadingOpenings(false))
  }

  function loadApplications() {
    setLoadingApps(true)
    fetch('/api/careers/applications')
      .then(r => r.json())
      .then(d => setApplications(Array.isArray(d) ? d : []))
      .finally(() => setLoadingApps(false))
  }

  useEffect(() => { loadOpenings() }, [trash])
  useEffect(() => { if (tab === 'applications') loadApplications() }, [tab])

  async function save() {
    if (!editing?.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = isNew
        ? await fetch('/api/careers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/careers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'Opening added' : 'Saved'); setEditing(null); loadOpenings() }
      else toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteOpening(id: string) {
    if (!confirm('Move this opening to trash?')) return
    const res = await fetch(`/api/careers?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); loadOpenings() }
    else toast.error('Delete failed')
  }

  async function restoreOpening(id: string) {
    await fetch('/api/careers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    loadOpenings()
  }

  async function updateAppStatus(id: string, status: string) {
    const res = await fetch('/api/careers/applications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (res.ok) { toast.success('Updated'); loadApplications() }
    else toast.error('Update failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Careers</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Job openings across Trainee Program, Qualified Lawyers, Business Services, and Support Staff, plus incoming applications.</p>
        </div>
        {tab === 'openings' && !trash && (
          <button onClick={() => { setEditing({ category: 'qualified_lawyers', is_open: true }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Opening
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-[var(--color-border)]">
        <button onClick={() => setTab('openings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'openings' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'}`}>
          <Briefcase className="w-4 h-4" /> Openings
        </button>
        <button onClick={() => setTab('applications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'applications' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'}`}>
          <Inbox className="w-4 h-4" /> Applications {applications.length > 0 && <span className="badge text-[10px]">{applications.length}</span>}
        </button>
      </div>

      {tab === 'openings' ? (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => setTrash(!trash)} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
              <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
            </button>
          </div>

          {loadingOpenings ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : openings.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">No job openings found.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {openings.map(job => (
                <div key={job.id} className="card p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{job.title}</h3>
                      <span className="badge text-xs">{categoryLabel(job.category)}</span>
                      {!job.is_open && <span className="badge status-rejected text-xs">Closed</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
                      {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                      {job.employment_type && <span>{job.employment_type}</span>}
                      {job.deadline && <span>Deadline {formatDate(job.deadline, 'short')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {trash ? (
                      <button onClick={() => restoreOpening(job.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(job); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteOpening(job.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {loadingApps ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : applications.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">
              <Users2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              No applications yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {applications.map(app => (
                <div key={app.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{app.full_name}</h3>
                      <span className="badge text-xs">{categoryLabel(app.category)}</span>
                      {app.job_openings?.title && <span className="text-xs text-[var(--color-muted)]">for {app.job_openings.title}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] flex-wrap">
                      <a href={`mailto:${app.email}`} className="hover:text-[var(--color-accent)]">{app.email}</a>
                      {app.phone && <span>{app.phone}</span>}
                      <span>{formatDate(app.created_at, 'short')}</span>
                      {app.resume_url && <a href={app.resume_url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent)] underline">Resume/CV link</a>}
                    </div>
                    {app.message && <p className="text-xs text-[var(--color-text-secondary)] mt-2 max-w-xl">{app.message}</p>}
                  </div>
                  <select value={app.status} onChange={e => updateAppStatus(app.id, e.target.value)}
                    className={`input text-xs flex-shrink-0 !w-auto !py-1.5 ${getStatusColor(app.status)}`}>
                    {APP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Opening' : 'Edit Opening'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input text-sm" value={editing.category || 'qualified_lawyers'} onChange={e => setEditing({ ...editing, category: e.target.value as JobOpening['category'] })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Employment Type</label>
                  <input className="input text-sm" value={editing.employment_type || ''} onChange={e => setEditing({ ...editing, employment_type: e.target.value })} placeholder="Full-time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Location</label>
                  <input className="input text-sm" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} placeholder="Nairobi, Kenya" />
                </div>
                <div>
                  <label className="label">Deadline</label>
                  <input type="date" className="input text-sm" value={editing.deadline?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Summary</label>
                <textarea rows={2} className="input text-sm" value={editing.summary || ''} onChange={e => setEditing({ ...editing, summary: e.target.value })} placeholder="One or two lines shown on the careers page" />
              </div>
              <div>
                <label className="label">Full Description</label>
                <textarea rows={4} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Requirements</label>
                <textarea rows={3} className="input text-sm" value={editing.requirements || ''} onChange={e => setEditing({ ...editing, requirements: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_open ?? true} onChange={e => setEditing({ ...editing, is_open: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Open for applications</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Opening' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
