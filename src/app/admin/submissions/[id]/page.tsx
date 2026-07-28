'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, User, Mail, Phone, Calendar, MessageSquare, Sparkles, Scale, ArrowRight, Eye, UserCog, RefreshCw, History, FileText } from 'lucide-react'
import { formatDate, getStatusColor, MATTER_TYPES } from '@/lib/utils'
import PipelineStepper from '@/components/admin/PipelineStepper'
import SuggestedSolutions from '@/components/admin/SuggestedSolutions'
import SectionCard from '@/components/admin/SectionCard'
import { SECTION_COLORS } from '@/lib/sectionColors'
import type { IntakeStage } from '@/lib/intakeLifecycle'
import toast from 'react-hot-toast'

const STATUSES = ['pending', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'completed', 'on_hold', 'awaiting_info']

interface SubmissionEvent {
  id: string
  type: 'opened' | 'assigned' | 'status_changed' | 'note_added' | 'promoted'
  detail: string | null
  created_at: string
  actor?: { full_name: string } | null
}

const EVENT_ICON: Record<string, React.ElementType> = {
  opened: Eye,
  assigned: UserCog,
  status_changed: RefreshCw,
  note_added: MessageSquare,
  promoted: Scale,
}
const EVENT_LABEL: Record<string, string> = {
  opened: 'Opened',
  assigned: 'Assignment changed',
  status_changed: 'Status changed',
  note_added: 'Note added',
  promoted: 'Promoted to matter',
}

export default function SubmissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [sub, setSub] = useState<Record<string, unknown> | null>(null)
  const [team, setTeam] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [updateForm, setUpdateForm] = useState({ status: '', message: '', is_public: true })
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkedMatter, setLinkedMatter] = useState<{ id: string; matter_number: string; status: string } | null>(null)
  const [promoting, setPromoting] = useState(false)

  const [meetings, setMeetings] = useState<{ id: string; title: string; start_at: string }[]>([])
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', startTime: '', endTime: '' })
  const [schedulingMeeting, setSchedulingMeeting] = useState(false)
  const [tasks, setTasks] = useState<{ id: string; title: string; status: string; assignee?: { full_name: string } | null }[]>([])
  const [taskDraft, setTaskDraft] = useState('')
  const [assigningTask, setAssigningTask] = useState(false)

  function loadMeetingsAndTasks() {
    Promise.all([
      fetch(`/api/calendar-events?submission_id=${params.id}`).then(r => r.json()).catch(() => []),
      fetch(`/api/matter-tasks?submission_id=${params.id}`).then(r => r.json()).catch(() => []),
    ]).then(([m, t]) => {
      setMeetings(Array.isArray(m) ? m : [])
      setTasks(Array.isArray(t) ? t : [])
    })
  }

  function refetchSubmission() {
    fetch(`/api/submissions/${params.id}`).then(r => r.json()).then(submission => {
      setSub(submission)
      setUpdateForm(f => ({ ...f, status: (submission.status as string) || f.status }))
    })
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/submissions/${params.id}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
      fetch(`/api/files/matters?submission_id=${params.id}&limit=1`).then(r => r.json()),
    ]).then(([submission, teamData, mattersRes]) => {
      setSub(submission)
      setTeam(teamData || [])
      setUpdateForm(f => ({ ...f, status: (submission.status as string) || '' }))
      setLinkedMatter(mattersRes?.data?.[0] || null)
    }).finally(() => setLoading(false))
    loadMeetingsAndTasks()
  }, [params.id])

  async function scheduleMeeting() {
    if (!sub) return
    if (!meetingForm.title.trim() || !meetingForm.date || !meetingForm.startTime || !meetingForm.endTime) {
      toast.error('Title, date, and start/end time are required')
      return
    }
    setSchedulingMeeting(true)
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingForm.title.trim(),
          type: 'meeting',
          start_at: new Date(`${meetingForm.date}T${meetingForm.startTime}`).toISOString(),
          end_at: new Date(`${meetingForm.date}T${meetingForm.endTime}`).toISOString(),
          submission_id: sub.id,
          attendees: [{ external_name: sub.submitter_name, external_email: sub.submitter_email }],
        }),
      })
      if (res.ok) {
        toast.success('Meeting scheduled, invite sent')
        setShowMeetingForm(false)
        setMeetingForm({ title: '', date: '', startTime: '', endTime: '' })
        loadMeetingsAndTasks()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not schedule the meeting')
      }
    } finally {
      setSchedulingMeeting(false)
    }
  }

  async function assignResearchTask() {
    if (!sub || !taskDraft.trim()) return
    setAssigningTask(true)
    try {
      const res = await fetch('/api/matter-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: sub.id, title: taskDraft.trim() }),
      })
      if (res.ok) { setTaskDraft(''); loadMeetingsAndTasks() }
      else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not assign the task')
      }
    } finally {
      setAssigningTask(false)
    }
  }

  async function promoteToMatter() {
    if (!sub) return
    setPromoting(true)
    try {
      const data = (sub.data || {}) as Record<string, string>
      const matterTypeValue = MATTER_TYPES.find(m => m.label === data.matter_type)?.value || 'other'
      const res = await fetch('/api/files/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${sub.submitter_name}, ${data.matter_type || (sub.type as string)}`,
          client_name: sub.submitter_name,
          type: matterTypeValue,
          description: data.message || data.description || '',
          submission_id: sub.id,
          ...(data.county && data.county !== '(skipped)' ? { county: data.county } : {}),
        }),
      })
      if (res.ok) {
        const matter = await res.json()
        toast.success('Matter opened as a lead')
        router.push(`/admin/matters/${matter.id}`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Could not open matter')
      }
    } finally {
      setPromoting(false)
    }
  }

  async function getAISuggestion() {
    if (!sub) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Write a professional update email for a ${sub.type} submission. Status change to: ${updateForm.status}. Applicant name: ${sub.submitter_name}. Keep it concise and professional.` }],
        }),
      })
      const data = await res.json()
      setUpdateForm(f => ({ ...f, message: data.response || '' }))
    } catch { toast.error('AI unavailable') }
    finally { setAiLoading(false) }
  }

  async function sendUpdate() {
    if (!updateForm.status || !updateForm.message) { toast.error('Status and message are required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/submissions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      })
      if (res.ok) {
        toast.success('Update sent!')
        const updated = await res.json()
        setSub(updated)
      } else toast.error('Update failed')
    } catch { toast.error('Network error') }
    finally { setSaving(false) }
  }

  async function assignTo(attorney_id: string) {
    await fetch(`/api/submissions/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: attorney_id }),
    })
    toast.success('Assigned!')
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!sub) return <div className="text-center py-20 text-[var(--color-muted)]">Submission not found.</div>

  const data = (sub.data || {}) as Record<string, string>
  const updates = (sub.updates as { id: string; status: string; message: string; is_public: boolean; created_at: string }[]) || []
  const events = ((sub.events as SubmissionEvent[]) || []).slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Submissions
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Header Card */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="font-mono text-sm text-[var(--color-accent)] font-bold">{sub.tracking_code as string}</span>
                <h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mt-1">
                  {(sub.submitter_name as string)}'s {(sub.type as string).charAt(0).toUpperCase() + (sub.type as string).slice(1)} Submission
                </h1>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge ${getStatusColor(sub.status as string)}`}>{(sub.status as string).replace(/_/g, ' ')}</span>
                {sub.first_opened_at ? (
                  <span className="text-xs text-[var(--color-muted)]">Opened {formatDate(sub.first_opened_at as string, 'short')}</span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">Not yet opened</span>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {Boolean(sub.ai_summary) && (
              <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                  <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">AI Analysis</span>
                  {Boolean(sub.ai_score) && (
                    <span className="ml-auto text-xs font-bold text-[var(--color-accent)]">Score: {sub.ai_score as number}/10</span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{sub.ai_summary as string}</p>
              </div>
            )}

            {/* Submitter Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: User, label: 'Name', value: sub.submitter_name as string },
                { icon: Mail, label: 'Email', value: sub.submitter_email as string },
                { icon: Phone, label: 'Phone', value: (sub.submitter_phone as string) || '-' },
                { icon: Calendar, label: 'Submitted', value: formatDate(sub.created_at as string, 'datetime') },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
                  <div>
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider">{label}</div>
                    <div className="text-sm text-[var(--color-text-primary)]">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Intake Pipeline, the continuous tracker from first contact
              through to promotion: Client Request -> Conflict Check ->
              Problem Identification -> Client Instruction -> Legal Opinion
              -> Retention -> Promoted to Matter. Only enquiry types that
              could become a matter carry a stage at all. */}
          {['contact', 'appointment'].includes(sub.type as string) && Boolean(sub.intake_stage) && (
            <PipelineStepper
              submissionId={sub.id as string}
              intakeStage={sub.intake_stage as IntakeStage}
              onAdvance={refetchSubmission}
            />
          )}

          {/* Suggested Solutions, disabled for now, the suggestions were
              coming back unreliable, revisit once the matching logic is
              improved (matches the same call on the matter page). */}
          {false && (
            <SuggestedSolutions
              matterType={MATTER_TYPES.find(m => m.label === data.matter_type)?.value || null}
              county={data.county && data.county !== '(skipped)' ? data.county : null}
              submissionId={(sub?.id as string) || ''}
            />
          )}

          {/* Submission Data */}
          <SectionCard title="Submission Details" icon={FileText} color="slate" defaultOpen>
            <div className="flex flex-col gap-3">
              {Object.entries(data).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-2">
                  <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider capitalize col-span-1">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] col-span-2 whitespace-pre-wrap">{String(value)}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Activity Timeline, every system event on this inquiry: opened,
              assigned, status changes, promotion to matter. Internal record,
              distinct from the client-facing Status History below. Collapsed
              by default, historical rather than a working area. */}
          {events.length > 0 && (
            <SectionCard title="Activity Timeline" icon={History} color="slate" badge={<span className="text-xs text-[var(--color-muted)] ml-1">{events.length}</span>}>
              <div className="flex flex-col gap-3">
                {events.map(e => {
                  const Icon = EVENT_ICON[e.type] || History
                  return (
                    <div key={e.id} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-[var(--color-surface-overlay)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{EVENT_LABEL[e.type] || e.type}</span>
                          <span className="text-xs text-[var(--color-muted)]">{formatDate(e.created_at, 'datetime')}</span>
                        </div>
                        {e.detail && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{e.detail}</p>}
                        {e.actor?.full_name && <p className="text-xs text-[var(--color-muted)] mt-0.5">by {e.actor.full_name}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Status Updates Timeline, client-facing, kept open since staff
              check it before sending a new update. */}
          <SectionCard title="Status History" icon={MessageSquare} color="green" defaultOpen>
            <div className="flex flex-col gap-3">
              {updates.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No updates yet.</p>
              ) : (
                updates.map(u => (
                  <div key={u.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${getStatusColor(u.status)} text-xs`}>{u.status.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-[var(--color-muted)]">{formatDate(u.created_at, 'datetime')}</span>
                        {!u.is_public && <span className="text-xs text-[var(--color-muted)] italic">(internal)</span>}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">{u.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Promote to Matter */}
          {['contact', 'appointment'].includes(sub.type as string) && (
            <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: SECTION_COLORS.blue }}>
              <h3 className="font-display font-semibold mb-3 flex items-center gap-2" style={{ color: SECTION_COLORS.blue }}>
                <Scale className="w-4 h-4" /> Matter
              </h3>
              {linkedMatter ? (
                <div>
                  <p className="text-xs text-[var(--color-muted)] mb-2">Already linked to a matter.</p>
                  <Link href={`/admin/matters/${linkedMatter.id}`} className="btn btn-outline gap-2 text-sm w-full justify-center">
                    <span className="font-mono">{linkedMatter.matter_number}</span> <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : sub.intake_stage === 'declined' ? (
                <p className="text-xs text-red-500">
                  This enquiry was declined at conflict check and cannot be promoted to a matter.
                </p>
              ) : (
                <div>
                  <p className="text-xs text-[var(--color-muted)] mb-3">Open this as a legal matter, it starts as an unvetted lead and carries the submission&apos;s details forward.</p>
                  {['received', 'conflict_check'].includes(sub.intake_stage as string) && (
                    <p className="text-xs text-amber-600 mb-3">This enquiry hasn&apos;t cleared conflict check yet, run one on the pipeline above first.</p>
                  )}
                  <button onClick={promoteToMatter} disabled={promoting} className="btn btn-primary gap-2 text-sm w-full justify-center">
                    {promoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                    Promote to Matter
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Meetings & research, before any matter exists */}
          <SectionCard title="Meetings & Tasks" icon={Calendar} color="blue"
            badge={(meetings.length + tasks.length) > 0 ? <span className="text-xs text-[var(--color-muted)] ml-1">{meetings.length + tasks.length}</span> : undefined}>
            <p className="text-xs text-[var(--color-muted)] mb-3">Book a meeting or assign research on this enquiry, no matter needs to exist yet.</p>

            {meetings.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {meetings.map(m => (
                  <Link key={m.id} href="/admin/calendar" className="flex items-center justify-between text-xs bg-[var(--color-surface-overlay)] rounded-md px-2.5 py-2 hover:bg-[var(--color-surface-raised)] transition-colors">
                    <span className="text-[var(--color-text-primary)]">{m.title}</span>
                    <span className="text-[var(--color-muted)]">{formatDate(m.start_at, 'short')}</span>
                  </Link>
                ))}
              </div>
            )}
            <button onClick={() => setShowMeetingForm(v => !v)} className="btn btn-outline gap-2 text-xs w-full justify-center mb-3">
              <Calendar className="w-3.5 h-3.5" /> Schedule Meeting
            </button>
            {showMeetingForm && (
              <div className="flex flex-col gap-2 mb-4 p-3 rounded-md bg-[var(--color-surface-overlay)]">
                <input className="input text-sm" placeholder="Meeting title" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} />
                <div className="grid grid-cols-3 gap-1.5">
                  <input type="date" className="input text-sm col-span-1" value={meetingForm.date} onChange={e => setMeetingForm(f => ({ ...f, date: e.target.value }))} />
                  <input type="time" className="input text-sm" value={meetingForm.startTime} onChange={e => setMeetingForm(f => ({ ...f, startTime: e.target.value }))} />
                  <input type="time" className="input text-sm" value={meetingForm.endTime} onChange={e => setMeetingForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <button onClick={scheduleMeeting} disabled={schedulingMeeting} className="btn btn-primary text-xs">
                  {schedulingMeeting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Invite client & notify'}
                </button>
              </div>
            )}

            {tasks.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3">
                {tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-[var(--color-surface-overlay)] rounded-md px-2.5 py-2">
                    <span className={t.status === 'done' ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-text-primary)]'}>{t.title}</span>
                    <span className="text-[var(--color-muted)]">{t.assignee?.full_name || 'Unassigned'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input className="input text-sm flex-1" placeholder="e.g. Research employment claim precedent" value={taskDraft} onChange={e => setTaskDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && assignResearchTask()} />
              <button onClick={assignResearchTask} disabled={assigningTask} className="btn btn-outline text-xs gap-1.5 flex-shrink-0">
                {assigningTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
              </button>
            </div>
          </SectionCard>

          {/* Send Update */}
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: SECTION_COLORS.green }}>
            <h3 className="font-display font-semibold mb-4" style={{ color: SECTION_COLORS.green }}>Send Update</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">New Status</label>
                <select value={updateForm.status} onChange={e => setUpdateForm(f => ({ ...f, status: e.target.value }))} className="input text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Message</label>
                  <button onClick={getAISuggestion} disabled={aiLoading} className="text-xs text-[var(--color-accent)] flex items-center gap-1 hover:underline">
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Draft
                  </button>
                </div>
                <textarea rows={4} value={updateForm.message} onChange={e => setUpdateForm(f => ({ ...f, message: e.target.value }))} className="input text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={updateForm.is_public} onChange={e => setUpdateForm(f => ({ ...f, is_public: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Notify applicant via email</span>
              </label>
              <button onClick={sendUpdate} disabled={saving} className="btn btn-primary gap-2 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Update
              </button>
            </div>
          </div>

          {/* Assign Attorney */}
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: SECTION_COLORS.purple }}>
            <h3 className="font-display font-semibold mb-3" style={{ color: SECTION_COLORS.purple }}>Assign To</h3>
            <select onChange={e => assignTo(e.target.value)} className="input text-sm"
              defaultValue={(sub.assigned_to as string) || ''}>
              <option value="">Unassigned</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>

          {/* Internal Notes */}
          <div className="card p-5 border-l-[3px]" style={{ borderLeftColor: SECTION_COLORS.slate }}>
            <h3 className="font-display font-semibold mb-3" style={{ color: SECTION_COLORS.slate }}>Internal Notes</h3>
            <textarea
              rows={4}
              defaultValue={(sub.internal_notes as string) || ''}
              className="input text-sm"
              placeholder="Private notes (not sent to applicant)…"
              onBlur={async e => {
                await fetch(`/api/submissions/${params.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ internal_notes: e.target.value }),
                })
              }}
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">Auto-saves on blur.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
