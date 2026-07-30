'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit, ArchiveRestore, MapPin, Briefcase, Users2, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import {
  PageHeader, Modal, DataTable, StatusPill, EmptyState, LoadingState, SearchInput,
  FilterTabs, type Column, type Tone,
} from '@/components/admin/ui'

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

const STAGES: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview' },
  { value: 'offer_extended', label: 'Offer' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Declined' },
]
const STAGE_TONE: Record<string, Tone> = {
  new: 'neutral',
  reviewing: 'done',
  shortlisted: 'review',
  interview_scheduled: 'risk',
  offer_extended: 'risk',
  hired: 'safe',
  rejected: 'overdue',
}

export default function RecruitmentHubPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'applications' | 'openings'>('applications')

  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [loadingOpenings, setLoadingOpenings] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<JobOpening> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')

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
  useEffect(() => { loadApplications() }, [])

  async function save() {
    if (!editing?.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/careers', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Opening added' : 'Saved'); setEditing(null); loadOpenings() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function deleteOpening(id: string) {
    if (!confirm('Move this opening to trash? Applications already received stay on file.')) return
    const res = await fetch(`/api/careers?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); loadOpenings() }
    else toast.error('Delete failed')
  }

  async function restoreOpening(id: string) {
    await fetch('/api/careers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    loadOpenings()
  }

  const filteredApplications = applications.filter(a => {
    if (stageFilter !== 'all' && a.status !== stageFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.job_openings?.title || '').toLowerCase().includes(q)
  })
  const stageCounts = applications.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {})
  const needsAttention = (stageCounts.new || 0) + (stageCounts.reviewing || 0)

  const columns: Column<JobApplication>[] = [
    {
      label: 'Applicant',
      render: a => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-primary)] truncate">{a.full_name}</div>
          <div className="text-xs text-[var(--color-text-muted)] truncate">{a.email}</div>
        </div>
      ),
    },
    {
      label: 'Applied for',
      secondary: true,
      render: a => a.job_openings?.title || categoryLabel(a.category),
    },
    { label: 'Category', secondary: true, render: a => categoryLabel(a.category) },
    { label: 'Stage', render: a => <StatusPill tone={STAGE_TONE[a.status] || 'neutral'} dot>{STAGES.find(s => s.value === a.status)?.label || a.status}</StatusPill> },
    { label: 'Applied', secondary: true, render: a => formatDate(a.created_at, 'short') },
    {
      // Whole row is clickable (onRowClick below); this is just the
      // affordance that signals it, not a separate navigation target.
      label: '',
      className: 'w-8 text-right',
      render: () => <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />,
    },
  ]

  const addOpeningButton = (
    <button onClick={() => { setEditing({ category: 'qualified_lawyers', is_open: true }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Opening
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={Users2}
        eyebrow="Staff"
        title="Recruitment"
        description="Postings, applications, and the pipeline from first contact through to onboarding."
        meta={[`${openings.filter(o => o.is_open).length} open positions`, `${applications.length} applications on file`]}
      >
        <FilterTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'applications', label: 'Applications', count: applications.length },
            { value: 'openings', label: 'Openings', count: openings.length },
          ]}
        />
      </PageHeader>

      {tab === 'applications' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            {STAGES.map(s => {
              const active = stageFilter === s.value
              const count = stageCounts[s.value] ?? 0
              return (
                <button
                  key={s.value}
                  onClick={() => setStageFilter(active ? 'all' : s.value)}
                  aria-pressed={active}
                  className={`card px-3 py-2.5 text-left transition-all border-l-[3px] ${active ? '' : 'border-l-transparent'} ${count === 0 ? 'opacity-50' : ''}`}
                  style={active ? { borderLeftColor: 'var(--color-brand)' } : undefined}
                >
                  <div className="font-display text-xl font-semibold text-[var(--color-text-primary)] tabular-nums leading-none">{count}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">{s.label}</div>
                </button>
              )
            })}
          </div>

          <div className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search applicant, email, or position…" className="max-w-sm" />
          </div>

          <DataTable
            caption="Job applications"
            columns={columns}
            rows={filteredApplications}
            rowKey={a => a.id}
            loading={loadingApps}
            onRowClick={a => router.push(`/admin/recruitment/${a.id}`)}
            empty={
              <EmptyState
                icon={Users2}
                title={search || stageFilter !== 'all' ? 'No applications match those filters' : 'No applications yet'}
                description={needsAttention > 0 ? undefined : 'Applications from the public careers page will appear here.'}
              />
            }
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <FilterTabs
              value={trash ? 'trash' : 'live'}
              onChange={v => setTrash(v === 'trash')}
              options={[{ value: 'live', label: 'Live' }, { value: 'trash', label: 'Trash' }]}
            />
            {!trash && addOpeningButton}
          </div>

          {loadingOpenings ? (
            <LoadingState />
          ) : openings.length === 0 ? (
            <EmptyState icon={Briefcase} title="No job openings yet" description="Add the first position to start receiving applications." action={!trash && addOpeningButton} />
          ) : (
            <div className="flex flex-col gap-2">
              {openings.map(job => (
                <div key={job.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{job.title}</h3>
                      <StatusPill>{categoryLabel(job.category)}</StatusPill>
                      {!job.is_open && <StatusPill tone="overdue">Closed</StatusPill>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                      {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                      {job.employment_type && <span>{job.employment_type}</span>}
                      {job.deadline && <span>Deadline {formatDate(job.deadline, 'short')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {trash ? (
                      <button onClick={() => restoreOpening(job.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(job); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteOpening(job.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Opening' : 'Edit Opening'}
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Opening' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={editing?.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input text-sm" value={editing?.category || 'qualified_lawyers'} onChange={e => setEditing({ ...editing, category: e.target.value as JobOpening['category'] })}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employment Type</label>
            <input className="input text-sm" value={editing?.employment_type || ''} onChange={e => setEditing({ ...editing, employment_type: e.target.value })} placeholder="Full-time" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <input className="input text-sm" value={editing?.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} placeholder="Nairobi, Kenya" />
          </div>
          <div>
            <label className="label">Deadline</label>
            <input type="date" className="input text-sm" value={editing?.deadline?.slice(0, 10) || ''} onChange={e => setEditing({ ...editing, deadline: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Summary</label>
          <textarea rows={2} className="input text-sm" value={editing?.summary || ''} onChange={e => setEditing({ ...editing, summary: e.target.value })} placeholder="One or two lines shown on the careers page" />
        </div>
        <div>
          <label className="label">Full Description</label>
          <textarea rows={4} className="input text-sm" value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Requirements</label>
          <textarea rows={3} className="input text-sm" value={editing?.requirements || ''} onChange={e => setEditing({ ...editing, requirements: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editing?.is_open ?? true} onChange={e => setEditing({ ...editing, is_open: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Open for applications</span>
        </label>
      </Modal>
    </div>
  )
}
