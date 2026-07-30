'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, User, Mail, Phone, Calendar, Download, ExternalLink,
  MessageSquare, History, UserCog, GraduationCap, Award, ArrowRight, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import SectionCard from '@/components/admin/SectionCard'
import { StatusPill, LoadingState, EmptyState, type Tone } from '@/components/admin/ui'

interface Application {
  id: string
  job_id: string | null
  category: string
  full_name: string
  email: string
  phone?: string
  message?: string
  resume_url?: string
  resume_file_url?: string
  resume_file_name?: string
  status: string
  rejection_reason?: string
  created_at: string
  assigned_to: string | null
  assignee?: { id: string; full_name: string; position: string } | null
  reviewer?: { full_name: string } | null
  onboarded_at?: string | null
  onboarded_profile_id?: string | null
  onboarded_team_member_id?: string | null
  certificate_id?: string | null
  job_openings?: { id: string; title: string; category: string; location?: string } | null
  notes: { id: string; content: string; created_at: string; author?: { full_name: string } | null }[]
  events: { id: string; type: string; detail: string | null; created_at: string; actor?: { full_name: string } | null }[]
  interviews: { id: string; title: string; start_at: string; end_at: string; location?: string; meeting_link?: string; status: string }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  trainee_program: 'Trainee Program',
  qualified_lawyers: 'Qualified Lawyers',
  business_services: 'Business Services',
  support_staff: 'Support Staff',
}

// The pipeline order. Rejected is reachable from anywhere via the separate
// "Decline" action below, not a step in this line.
const STAGES: { value: string; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'offer_extended', label: 'Offer Extended' },
  { value: 'hired', label: 'Hired' },
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
const EVENT_LABEL: Record<string, string> = {
  status_changed: 'Stage changed',
  note_added: 'Note added',
  interview_scheduled: 'Interview scheduled',
  onboarded: 'Onboarded',
  certified: 'Certificate issued',
}

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [app, setApp] = useState<Application | null>(null)
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [noteDraft, setNoteDraft] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [notifyApplicant, setNotifyApplicant] = useState(true)
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const [showInterviewForm, setShowInterviewForm] = useState(false)
  const [interviewForm, setInterviewForm] = useState({ title: 'Interview', date: '', startTime: '', endTime: '', location: '' })
  const [schedulingInterview, setSchedulingInterview] = useState(false)

  const [showOnboardForm, setShowOnboardForm] = useState(false)
  const [onboardForm, setOnboardForm] = useState({ position: '', department: '' })
  const [onboarding, setOnboarding] = useState(false)

  const [showCertForm, setShowCertForm] = useState(false)
  const [certForm, setCertForm] = useState({ title: '', description: '' })
  const [issuingCert, setIssuingCert] = useState(false)

  function load() {
    fetch(`/api/careers/applications/${params.id}`)
      .then(r => r.json())
      .then(setApp)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch('/api/team').then(r => r.json()).then(d => setTeam(Array.isArray(d) ? d : []))
  }, [params.id])

  async function transition(status: string, extra?: Record<string, unknown>) {
    if (!app) return
    setTransitioning(status)
    try {
      const res = await fetch(`/api/careers/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notify_applicant: notifyApplicant, ...extra }),
      })
      if (res.ok) {
        toast.success(`Moved to ${STAGES.find(s => s.value === status)?.label || status}`)
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not update the stage')
      }
    } finally { setTransitioning(null) }
  }

  async function decline() {
    if (!declineReason.trim()) { toast.error('A reason is required to decline'); return }
    setDeclining(true)
    try {
      const res = await fetch(`/api/careers/applications/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejection_reason: declineReason.trim(), notify_applicant: notifyApplicant }),
      })
      if (res.ok) { toast.success('Application declined'); setDeclineReason(''); load() }
      else toast.error('Could not decline the application')
    } finally { setDeclining(false) }
  }

  async function addNote() {
    if (!noteDraft.trim() || !app) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/careers/applications/${app.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteDraft.trim() }),
      })
      if (res.ok) { setNoteDraft(''); load() } else toast.error('Could not add the note')
    } finally { setAddingNote(false) }
  }

  async function reassign(teamMemberId: string) {
    if (!app) return
    const res = await fetch(`/api/careers/applications/${app.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to: teamMemberId || null }),
    })
    if (res.ok) { toast.success('Reassigned'); load() } else toast.error('Could not reassign')
  }

  async function scheduleInterview() {
    if (!app) return
    if (!interviewForm.date || !interviewForm.startTime || !interviewForm.endTime) {
      toast.error('Date, start, and end time are required'); return
    }
    setSchedulingInterview(true)
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: interviewForm.title,
          type: 'meeting',
          start_at: new Date(`${interviewForm.date}T${interviewForm.startTime}`).toISOString(),
          end_at: new Date(`${interviewForm.date}T${interviewForm.endTime}`).toISOString(),
          location: interviewForm.location || undefined,
          job_application_id: app.id,
          attendees: [{ external_name: app.full_name, external_email: app.email }],
        }),
      })
      if (res.ok) {
        toast.success('Interview scheduled, invite sent')
        setShowInterviewForm(false)
        setInterviewForm({ title: 'Interview', date: '', startTime: '', endTime: '', location: '' })
        // Scheduling implies the stage has reached "Interview Scheduled";
        // only auto-advance if it hasn't gotten there some other way.
        if (app.status !== 'interview_scheduled') await transition('interview_scheduled')
        else load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not schedule the interview')
      }
    } finally { setSchedulingInterview(false) }
  }

  async function hireAndOnboard() {
    if (!app) return
    setOnboarding(true)
    try {
      const res = await fetch(`/api/careers/applications/${app.id}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardForm),
      })
      if (res.ok) {
        toast.success('Onboarded. A staff profile has been created.')
        setShowOnboardForm(false)
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not complete onboarding')
      }
    } finally { setOnboarding(false) }
  }

  async function issueCertificate() {
    if (!app?.onboarded_profile_id) return
    if (!certForm.title.trim()) { toast.error('Title is required'); return }
    setIssuingCert(true)
    try {
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: app.onboarded_profile_id,
          type: 'achievement',
          title: certForm.title.trim(),
          description: certForm.description.trim(),
          issued_by: app.assigned_to,
          send_email: true,
        }),
      })
      if (res.ok) {
        const cert = await res.json()
        await fetch(`/api/careers/applications/${app.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ certificate_id: cert.id }),
        })
        toast.success('Certificate issued and sent')
        setShowCertForm(false)
        load()
      } else toast.error('Could not issue the certificate')
    } finally { setIssuingCert(false) }
  }

  if (loading) return <LoadingState label="Loading application" />
  if (!app) return <EmptyState title="Application not found" />

  const jobTitle = app.job_openings?.title || CATEGORY_LABELS[app.category] || app.category
  const stageIdx = STAGES.findIndex(s => s.value === app.status)
  const isDeclined = app.status === 'rejected'
  const isHired = app.status === 'hired'
  const nextStage = !isDeclined && stageIdx >= 0 && stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null

  return (
    <div>
      <button onClick={() => router.push('/admin/recruitment')} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Recruitment
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <span className="font-mono text-xs text-[var(--color-text-muted)]">Applying for</span>
                <h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mt-0.5">{jobTitle}</h1>
              </div>
              <StatusPill tone={STAGE_TONE[app.status] || 'neutral'} dot>{STAGES.find(s => s.value === app.status)?.label || (isDeclined ? 'Declined' : app.status)}</StatusPill>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                { icon: User, label: 'Name', value: app.full_name },
                { icon: Mail, label: 'Email', value: app.email },
                { icon: Phone, label: 'Phone', value: app.phone || '-' },
                { icon: Calendar, label: 'Applied', value: formatDate(app.created_at, 'datetime') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{label}</div>
                    <div className="text-sm text-[var(--color-text-primary)]">{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {(app.resume_file_url || app.resume_url) && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--color-border)]">
                {app.resume_file_url && (
                  <a href={app.resume_file_url} target="_blank" rel="noreferrer" className="btn btn-outline gap-2 text-xs">
                    <Download className="w-3.5 h-3.5" /> {app.resume_file_name || 'Resume'}
                  </a>
                )}
                {app.resume_url && (
                  <a href={app.resume_url} target="_blank" rel="noreferrer" className="btn btn-outline gap-2 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" /> Resume link
                  </a>
                )}
              </div>
            )}

            {app.message && (
              <div className="pt-3 mt-3 border-t border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Message</div>
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{app.message}</p>
              </div>
            )}
          </div>

          {/* Pipeline: acef's pattern, a plain sequence of stage buttons, no
              kanban. Each click is a single-step advance; decline is
              reachable from any non-terminal stage via its own control. */}
          <SectionCard title="Pipeline" icon={ArrowRight} color="blue" defaultOpen>
            <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
              {STAGES.map((s, i) => {
                const done = !isDeclined && i < stageIdx
                const current = !isDeclined && i === stageIdx
                return (
                  <div key={s.value} className="flex items-center flex-shrink-0">
                    <div className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium whitespace-nowrap ${
                      current ? 'bg-[var(--color-accent)] text-white' : done ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
                    }`}>
                      {s.label}
                    </div>
                    {i < STAGES.length - 1 && <div className={`w-4 h-px flex-shrink-0 ${done ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} />}
                  </div>
                )
              })}
              {isDeclined && <StatusPill tone="overdue">Declined</StatusPill>}
            </div>

            {!isDeclined && !isHired && (
              <>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={notifyApplicant} onChange={e => setNotifyApplicant(e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Email the applicant when the stage changes</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {nextStage && (
                    <button onClick={() => transition(nextStage.value)} disabled={!!transitioning} className="btn btn-primary text-sm gap-2">
                      {transitioning === nextStage.value ? 'Moving…' : `Advance to ${nextStage.label}`}
                    </button>
                  )}
                  {STAGES.slice(stageIdx + 2).map(s => (
                    <button key={s.value} onClick={() => transition(s.value)} disabled={!!transitioning} className="btn btn-outline text-xs">
                      {transitioning === s.value ? 'Moving…' : `Skip to ${s.label}`}
                    </button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <label className="label">Decline this application</label>
                  <div className="flex gap-2">
                    <input
                      className="input text-sm"
                      placeholder="Reason (sent to the applicant if notify is on)"
                      value={declineReason}
                      onChange={e => setDeclineReason(e.target.value)}
                    />
                    <button onClick={decline} disabled={declining} className="btn btn-ghost text-xs text-[var(--status-danger)] flex-shrink-0">
                      {declining ? 'Declining…' : 'Decline'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {isDeclined && app.rejection_reason && (
              <p className="text-xs text-[var(--color-text-secondary)]">Reason: {app.rejection_reason}</p>
            )}
          </SectionCard>

          <SectionCard title="Interviews" icon={Clock} color="blue"
            badge={app.interviews.length > 0 ? <StatusPill>{app.interviews.length}</StatusPill> : undefined}>
            {app.interviews.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {app.interviews.map(iv => (
                  <div key={iv.id} className="flex items-center justify-between text-xs bg-[var(--color-surface-overlay)] rounded-[var(--radius-md)] px-2.5 py-2">
                    <span className="text-[var(--color-text-primary)]">{iv.title}</span>
                    <span className="text-[var(--color-text-muted)]">{formatDate(iv.start_at, 'short')}</span>
                  </div>
                ))}
              </div>
            )}
            {!showInterviewForm ? (
              <button onClick={() => setShowInterviewForm(true)} className="btn btn-outline gap-2 text-xs w-full justify-center">
                <Calendar className="w-3.5 h-3.5" /> Schedule Interview
              </button>
            ) : (
              <div className="flex flex-col gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-overlay)]">
                <input className="input text-sm" placeholder="Interview title" value={interviewForm.title} onChange={e => setInterviewForm(f => ({ ...f, title: e.target.value }))} />
                <div className="grid grid-cols-3 gap-1.5">
                  <input type="date" className="input text-sm" value={interviewForm.date} onChange={e => setInterviewForm(f => ({ ...f, date: e.target.value }))} />
                  <input type="time" className="input text-sm" value={interviewForm.startTime} onChange={e => setInterviewForm(f => ({ ...f, startTime: e.target.value }))} />
                  <input type="time" className="input text-sm" value={interviewForm.endTime} onChange={e => setInterviewForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <input className="input text-sm" placeholder="Location or video link" value={interviewForm.location} onChange={e => setInterviewForm(f => ({ ...f, location: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={scheduleInterview} disabled={schedulingInterview} className="btn btn-primary text-xs flex-1">
                    {schedulingInterview ? 'Scheduling…' : 'Invite & Notify'}
                  </button>
                  <button onClick={() => setShowInterviewForm(false)} className="btn btn-ghost text-xs">Cancel</button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Internal Notes" icon={MessageSquare} color="green" defaultOpen>
            <div className="flex flex-col gap-2 mb-3">
              {app.notes.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No notes yet.</p>
              ) : (
                app.notes.map(n => (
                  <div key={n.id} className="text-xs py-2 px-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-overlay)]">
                    <div className="text-[var(--color-text-muted)] mb-1">{formatDate(n.created_at, 'short')}{n.author?.full_name ? ` · ${n.author.full_name}` : ''}</div>
                    <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <textarea rows={2} className="input text-sm" placeholder="Add an internal note…" value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
            </div>
            <button onClick={addNote} disabled={addingNote || !noteDraft.trim()} className="btn btn-outline text-xs mt-2">
              {addingNote ? 'Adding…' : 'Add Note'}
            </button>
          </SectionCard>

          {app.events.length > 0 && (
            <SectionCard title="Activity Timeline" icon={History} color="slate" badge={<StatusPill>{app.events.length}</StatusPill>}>
              <div className="flex flex-col gap-3">
                {app.events.map(e => (
                  <div key={e.id} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-surface-overlay)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <History className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{EVENT_LABEL[e.type] || e.type}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{formatDate(e.created_at, 'datetime')}</span>
                      </div>
                      {e.detail && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{e.detail}</p>}
                      {e.actor?.full_name && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">by {e.actor.full_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: '#6b5580' }}>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#6b5580' }}>
              <UserCog className="w-4 h-4" /> Reviewer
            </h3>
            <select className="input text-sm" value={app.assigned_to || ''} onChange={e => reassign(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            {app.reviewer?.full_name && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">Last reviewed by {app.reviewer.full_name}</p>
            )}
          </div>

          {/* Onboarding: only reachable once hired, creates the staff
              record but never a login, that stays a deliberate separate
              step in Admin -> Users. */}
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: '#3f7a5c' }}>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#3f7a5c' }}>
              <GraduationCap className="w-4 h-4" /> Onboarding
            </h3>
            {app.onboarded_profile_id ? (
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                  Onboarded {app.onboarded_at ? formatDate(app.onboarded_at, 'short') : ''}.
                </p>
                {app.onboarded_team_member_id && (
                  <Link href={`/admin/team/${app.onboarded_team_member_id}`} className="btn btn-outline gap-2 text-sm w-full justify-center">
                    View staff profile <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : !isHired ? (
              <p className="text-xs text-[var(--color-text-muted)]">Available once this applicant reaches Hired.</p>
            ) : !showOnboardForm ? (
              <button
                onClick={() => { setOnboardForm({ position: jobTitle, department: '' }); setShowOnboardForm(true) }}
                className="btn btn-primary text-sm w-full justify-center"
              >
                Hire & Onboard
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="label">Position</label>
                  <input className="input text-sm" value={onboardForm.position} onChange={e => setOnboardForm(f => ({ ...f, position: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Department</label>
                  <input className="input text-sm" value={onboardForm.department} onChange={e => setOnboardForm(f => ({ ...f, department: e.target.value }))} placeholder="Legal" />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Creates a staff profile. No sign-in access is granted, that stays a separate step.</p>
                <div className="flex gap-2">
                  <button onClick={hireAndOnboard} disabled={onboarding} className="btn btn-primary text-sm flex-1">
                    {onboarding ? 'Onboarding…' : 'Confirm'}
                  </button>
                  <button onClick={() => setShowOnboardForm(false)} className="btn btn-ghost text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Certification: unlocked once onboarded, hands off to the
              certificates feature that already exists rather than a
              parallel one. */}
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: '#a97d2f' }}>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#a97d2f' }}>
              <Award className="w-4 h-4" /> Certification
            </h3>
            {!app.onboarded_profile_id ? (
              <p className="text-xs text-[var(--color-text-muted)]">Available once this applicant has been onboarded.</p>
            ) : app.certificate_id ? (
              <Link href="/admin/certificates" className="btn btn-outline gap-2 text-sm w-full justify-center">
                View certificate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : !showCertForm ? (
              <button onClick={() => { setCertForm({ title: `Certificate of Employment, ${jobTitle}`, description: '' }); setShowCertForm(true) }} className="btn btn-primary text-sm w-full justify-center">
                Issue Certificate
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="label">Title</label>
                  <input className="input text-sm" value={certForm.title} onChange={e => setCertForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea rows={2} className="input text-sm" value={certForm.description} onChange={e => setCertForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={issueCertificate} disabled={issuingCert} className="btn btn-primary text-sm flex-1">
                    {issuingCert ? 'Issuing…' : 'Issue & Send'}
                  </button>
                  <button onClick={() => setShowCertForm(false)} className="btn btn-ghost text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
