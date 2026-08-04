'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Download, Trash2, Lock, FileText, Plus, Loader2, Eye, Shield, ArrowRight, Search, Send, Clock, Receipt, Circle, CheckCircle2, Users, History } from 'lucide-react'
import { formatDate, formatFileSize, formatCurrency, formatMinutes, getStatusColor, MATTER_TYPES, DOCUMENT_TYPES } from '@/lib/utils'
import { stagePermission, stageLabel, stageMeta, stageTaskSuggestions, type MatterStage } from '@/lib/matterLifecycle'
import { availableInvoiceTransitions, invoiceStatusLabel, INVOICE_STATUS_BADGE } from '@/lib/invoiceLifecycle'
import type { IntakeStage } from '@/lib/intakeLifecycle'
import PipelineStepper from '@/components/admin/PipelineStepper'
import SuggestedSolutions from '@/components/admin/SuggestedSolutions'
import ServiceOfProcessCard from '@/components/admin/ServiceOfProcessCard'
import CostEstimateCard from '@/components/admin/CostEstimateCard'
import MatterPipeline from '@/components/admin/MatterPipeline'
import AssignmentComposer from '@/components/admin/AssignmentComposer'
import type { WorkContext } from '@/lib/workContext'
import SectionCard from '@/components/admin/SectionCard'
import LitigationCard from '@/components/admin/LitigationCard'
import DocumentTemplateLauncher from '@/components/admin/DocumentTemplateLauncher'
import MatterBillingWorkspace from '@/components/admin/MatterBillingWorkspace'
import { KENYA_COUNTIES } from '@/lib/kenyaCounties'
import toast from 'react-hot-toast'

interface LegalDocument {
  id: string
  title: string
  type: string
  description?: string
  file_url: string
  file_name: string
  file_size: number
  mime_type: string
  version: number
  access_level: string
  is_privileged: boolean
  tags: string[]
  uploader?: { full_name: string }
  created_at: string
}

interface MatterPerson {
  id: string
  role: string
  profile?: { id: string; full_name: string; email: string; role: string; user_id: string | null } | null
}

interface LegalMatter {
  id: string
  matter_number: string
  title: string
  type: string
  status: string
  client_name: string
  opposing_party?: string
  court?: string
  case_number?: string
  claim_value?: number | null
  county?: string | null
  description?: string
  is_confidential: boolean
  opening_date: string
  assigned_attorney?: { full_name: string; position: string }
  people?: MatterPerson[]
  submission?: MatterSubmission | null
}

interface Revision {
  id: string
  data: { title?: string; description?: string; opposing_party?: string; court?: string; case_number?: string; tags?: string[] }
  note: string | null
  created_at: string
  author?: { full_name: string } | null
}

interface TimeEntry {
  id: string
  description: string
  entry_date: string
  minutes: number
  rate: number
  billable: boolean
  invoice_id: string | null
  author?: { full_name: string } | null
}

interface Invoice {
  id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'void'
  subtotal: number
  vat_rate: number
  vat_amount: number
  total: number
  due_date: string | null
  issued_at: string | null
  created_at: string
}

interface StageHistoryEntry {
  from_stage: string | null
  to_stage: string
  created_at: string
  actor?: { full_name: string } | null
}

interface MatterNote {
  id: string
  content: string
  stage: string | null
  created_at: string
  author?: { full_name: string } | null
}

interface MatterSubmission {
  id: string
  tracking_code: string
  type: string
  submitter_name: string
  submitter_email: string
  data: Record<string, string>
  intake_stage?: IntakeStage | null
  created_at: string
  updates: { status: string; message: string; is_public: boolean; created_at: string }[]
}

// One row in the matter's story, whatever kind of event it was.
interface StoryEvent {
  kind: string
  text: string
  by?: string
  date: string
}

interface ConflictMatch { match_type: string; name: string; detail: string; risk: 'low' | 'medium' | 'high' }

interface ConflictCheck {
  id: string
  search_query: string
  results: ConflictMatch[]
  highest_risk: string | null
  decision: 'pending' | 'proceed' | 'proceed_with_conditions' | 'declined'
  decision_notes: string | null
  created_at: string
  checker?: { full_name: string } | null
  decider?: { full_name: string } | null
}

export default function MatterDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [matter, setMatter] = useState<LegalMatter | null>(null)
  const [docs, setDocs] = useState<LegalDocument[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'other', description: '', access_level: 'staff', is_privileged: false, tags: '' })
  const [showUpload, setShowUpload] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [permissions, setPermissions] = useState<string[]>([])
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([])
  const [conflictChecks, setConflictChecks] = useState<ConflictCheck[]>([])

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [timeForm, setTimeForm] = useState({ description: '', minutes: '', rate: '', entry_date: new Date().toISOString().slice(0, 10) })
  const [addingTime, setAddingTime] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)

  const [notes, setNotes] = useState<MatterNote[]>([])
  const [team, setTeam] = useState<{ id: string; full_name: string; professional_type?: { id: string; name: string } | null }[]>([])
  const [showServicePanel, setShowServicePanel] = useState(false)
  const [showCostEstimate, setShowCostEstimate] = useState(false)
  const [showClientAccess, setShowClientAccess] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  async function load() {
    const matterId = params.id as string
    const [matterData, docsRes, checksRes, me, timeRes, invoicesRes, notesRes, teamRes] = await Promise.all([
      fetch(`/api/files/matters/${matterId}`).then(r => r.json()),
      fetch(`/api/files/documents?matter_id=${matterId}`).then(r => r.json()),
      fetch(`/api/conflict-checks?matter_id=${matterId}`).then(r => r.json()),
      fetch('/api/me').then(r => (r.ok ? r.json() : { permissions: [] })),
      fetch(`/api/time-entries?matter_id=${matterId}`).then(r => r.json()),
      fetch(`/api/invoices?matter_id=${matterId}`).then(r => r.json()),
      fetch(`/api/matter-notes?matter_id=${matterId}`).then(r => r.json()),
      fetch('/api/team?with_category=true').then(r => r.json()),
    ])
    setMatter(matterData || null)
    setRevisions(matterData?.revisions || [])
    setStageHistory(matterData?.stage_history || [])
    setDocs(docsRes || [])
    setConflictChecks(Array.isArray(checksRes) ? checksRes : [])
    setPermissions(me.permissions || [])
    setTimeEntries(Array.isArray(timeRes) ? timeRes : [])
    setInvoices(invoicesRes?.data || [])
    setNotes(Array.isArray(notesRes) ? notesRes : [])
    setTeam(Array.isArray(teamRes) ? teamRes : [])
    setLoading(false)
  }

  async function addNote() {
    if (!noteDraft.trim()) { toast.error('Write the note first'); return }
    setAddingNote(true)
    try {
      const res = await fetch('/api/matter-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: params.id, content: noteDraft.trim() }),
      })
      if (res.ok) { setNoteDraft(''); load() }
      else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not save the note')
      }
    } finally {
      setAddingNote(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  function canMakeTransition(from: MatterStage, to: MatterStage): boolean {
    return permissions.includes(stagePermission(from, to))
  }

  async function transition(to: MatterStage) {
    const res = await fetch(`/api/files/matters/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to }),
    })
    if (res.ok) {
      toast.success(`Moved to ${stageLabel(to)}`)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not update stage')
    }
  }

  function handleTransitionClick(to: MatterStage) {
    if (to === 'declined' || to === 'archived') {
      if (!confirm(`Move this matter to ${stageLabel(to)}? This can be reversed later if needed.`)) return
    }
    transition(to)
  }

  async function saveCaseDetail(field: 'county' | 'claim_value', value: string | number | null) {
    const res = await fetch(`/api/files/matters/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) load()
    else toast.error('Could not save')
  }

  const [invitingId, setInvitingId] = useState<string | null>(null)

  async function addTimeEntry() {
    const minutes = parseInt(timeForm.minutes)
    if (!timeForm.description.trim() || !minutes || minutes <= 0) {
      toast.error('A description and positive minutes are required')
      return
    }
    setAddingTime(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: params.id,
          description: timeForm.description.trim(),
          minutes,
          rate: parseFloat(timeForm.rate) || 0,
          entry_date: timeForm.entry_date,
        }),
      })
      if (res.ok) {
        setTimeForm(f => ({ ...f, description: '', minutes: '' }))
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not log time')
      }
    } finally {
      setAddingTime(false)
    }
  }

  async function deleteTimeEntry(id: string) {
    const res = await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Entry removed'); load() }
    else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not remove entry')
    }
  }

  async function generateInvoice() {
    setGeneratingInvoice(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: params.id, from_time_entries: true }),
      })
      if (res.ok) { toast.success('Draft invoice generated from unbilled time'); load() }
      else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not generate invoice')
      }
    } finally {
      setGeneratingInvoice(false)
    }
  }

  async function invoiceTransition(id: string, status: string) {
    if (status === 'void' && !confirm('Void this invoice? Its time entries will return to unbilled.')) return
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success(`Invoice marked ${status}`); load() }
    else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not update invoice')
    }
  }

  async function invitePerson(profileId: string) {
    setInvitingId(profileId)
    try {
      const res = await fetch('/api/people/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      })
      if (res.ok) toast.success('Sign-in link emailed to the client')
      else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not send the link')
      }
    } finally {
      setInvitingId(null)
    }
  }

  async function restoreRevision(revisionId: string) {
    if (!confirm('Restore this version? The current details will be saved as a new revision first.')) return
    setRestoring(revisionId)
    try {
      const res = await fetch(`/api/files/matters/${params.id}/revisions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision_id: revisionId }),
      })
      if (res.ok) { toast.success('Version restored'); load() }
      else toast.error('Could not restore version')
    } finally {
      setRestoring(null)
    }
  }

  async function uploadDocument() {
    if (!selectedFile || !uploadForm.title) { toast.error('File and title required'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('matter_id', params.id as string)
      fd.append('title', uploadForm.title)
      fd.append('type', uploadForm.type)
      fd.append('description', uploadForm.description)
      fd.append('access_level', uploadForm.access_level)
      fd.append('is_privileged', String(uploadForm.is_privileged))
      fd.append('tags', JSON.stringify(uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean)))

      const res = await fetch('/api/files/documents', { method: 'POST', body: fd })
      if (res.ok) {
        toast.success('Document uploaded!')
        setShowUpload(false)
        setSelectedFile(null)
        setUploadForm({ title: '', type: 'other', description: '', access_level: 'staff', is_privileged: false, tags: '' })
        load()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Upload failed')
      }
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const accessLevelColor: Record<string, string> = {
    public: 'status-active',
    client: 'status-pending',
    staff: 'status-review',
    admin: 'status-rejected',
    confidential: 'status-rejected',
  }

  // The page follows the matter's journey: while vetting (lead -> retainer),
  // the lifecycle and conflict check lead and billing stays out of the way;
  // once engaged, the stepper collapses and the work, time, billing,
  // documents, takes over. Section order is driven by this flag.
  const preEngagement = !!matter && ['lead', 'conflict_check', 'engagement_letter', 'retainer_pending'].includes(matter.status)
  const clientPerson = matter?.people?.find(p => p.role === 'client' && p.profile)

  // Resolved once, handed to every contextual action on this page so none of
  // them asks the user to restate the matter, stage or client they're already
  // looking at. stageKey (not stage_id/pipeline_stages, which nothing seeds
  // or reads for this firm) is what the workflow completion engine keys on.
  const workContext: WorkContext = {
    matterId: (params.id as string) || null,
    stageKey: matter?.status || null,
    stageLabel: matter ? stageLabel(matter.status) : null,
    clientName: matter?.client_name || null,
    clientProfileId: clientPerson?.profile?.id || null,
    matterNumber: matter?.matter_number || null,
    matterTitle: matter?.title || null,
    matterType: matter?.type || null,
  }

  // The matter's story, milestone by milestone: each stage the matter has
  // passed through collects what actually happened during it, notes,
  // feedback to the client, documents, conflict checks, invoices, and the
  // work logged (aggregated to one line so the record stays readable).
  const storySegments = (() => {
    if (stageHistory.length === 0) return []
    const events: (StoryEvent & { t: number })[] = []
    const push = (kind: string, text: string, date: string, by?: string) =>
      events.push({ kind, text, date, by, t: new Date(date).getTime() })

    // Conflict checks and stage transitions are deliberately left out here
    //, the Lifecycle pipeline above is now where that history lives, one
    // click per stage. This diary stays for what it alone carries: notes,
    // documents, invoices, and client communication.
    notes.forEach(n => push('Attendance Note', n.content, n.created_at, n.author?.full_name))
    docs.forEach(d => push('Document', d.title, d.created_at, d.uploader?.full_name))
    invoices.forEach(i => push('Invoice', `${i.invoice_number} · ${formatCurrency(Number(i.total))} · ${invoiceStatusLabel(i.status)}`, i.created_at))
    matter?.submission?.updates.forEach(u => push(u.is_public ? 'Client Communication' : 'Internal Update', u.message, u.created_at))

    return stageHistory.map((h, i) => {
      const start = new Date(h.created_at).getTime()
      const end = i < stageHistory.length - 1 ? new Date(stageHistory[i + 1].created_at).getTime() : Infinity
      // Anything predating the first milestone belongs to it.
      const inSegment = events
        .filter(e => (i === 0 ? e.t < end : e.t >= start && e.t < end))
        .sort((a, b) => a.t - b.t)
      const minutes = timeEntries
        .filter(e => { const t = new Date(e.entry_date).getTime(); return i === 0 ? t < end : t >= start && t < end })
        .reduce((s, e) => s + e.minutes, 0)
      return {
        stage: h.to_stage,
        start: h.created_at,
        end: i < stageHistory.length - 1 ? stageHistory[i + 1].created_at : null,
        events: inSegment,
        minutes,
      }
    })
  })()

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Matters
      </button>

      {matter ? (
        <>
          {/* Matter Header */}
          <div className="card p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-[var(--color-accent)]">{matter.matter_number}</span>
                  {matter.is_confidential && (
                    <span className="flex items-center gap-1 text-xs text-red-500"><Lock className="w-3 h-3" />Confidential</span>
                  )}
                </div>
                <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{matter.title}</h1>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(matter.people?.length ?? 0) > 0 && (
                  <button onClick={() => setShowClientAccess(v => !v)} className="btn btn-outline gap-1.5 text-xs">
                    <Users className="w-3.5 h-3.5" /> Client Access
                  </button>
                )}
                <span className={`badge ${getStatusColor(matter.status)}`}>{stageMeta(matter.status).label}</span>
              </div>
            </div>

            {showClientAccess && (matter.people?.length ?? 0) > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {matter.people!.map(person => (
                  <div key={person.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                    <div className="min-w-0">
                      {person.profile ? (
                        <Link href={`/admin/people/${person.profile.id}`} className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline">
                          {person.profile.full_name}
                        </Link>
                      ) : (
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">Unknown</div>
                      )}
                      <div className="text-xs text-[var(--color-muted)]">{person.profile?.email} · {person.role}</div>
                    </div>
                    {person.profile && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {person.profile.user_id && <span className="badge status-active text-xs">Portal active</span>}
                        <button
                          onClick={() => invitePerson(person.profile!.id)}
                          disabled={invitingId === person.profile.id}
                          className="btn btn-outline text-xs gap-1.5"
                        >
                          {invitingId === person.profile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {person.profile.user_id ? 'Send New Link' : 'Send Portal Access Link'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Client', value: matter.client_name, href: clientPerson?.profile ? `/admin/people/${clientPerson.profile.id}` : undefined },
                { label: 'Matter Type', value: MATTER_TYPES.find(m => m.value === matter.type)?.label || matter.type },
                { label: 'Attorney', value: matter.assigned_attorney?.full_name || '-' },
                { label: 'Opened', value: formatDate(matter.opening_date, 'long') },
                matter.opposing_party ? { label: 'Opposing Party', value: matter.opposing_party } : null,
                matter.court ? { label: 'Court', value: matter.court } : null,
                matter.case_number ? { label: 'Case Number', value: matter.case_number } : null,
              ].filter((item): item is { label: string; value: string; href?: string } => item !== null).map(({ label, value, href }) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">{label}</div>
                  {href ? (
                    <Link href={href} className="font-medium text-[var(--color-accent)] hover:underline">{value}</Link>
                  ) : (
                    <div className="font-medium text-[var(--color-text-primary)]">{value}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Litigation status and the court itself, the court chosen from
                the register rather than typed. */}
            <div className="mt-6">
              <LitigationCard
                matterId={matter.id}
                litigationStatus={(matter as { litigation_status?: string }).litigation_status}
                courtId={(matter as { court_id?: string | null }).court_id}
                legacyCourt={matter.court}
                caseNumber={matter.case_number}
                filedAt={(matter as { filed_at?: string | null }).filed_at}
                canEdit={permissions.includes('manage_matters')}
                onSaved={load}
              />
            </div>

            {/* County and claim value feed the court-routing suggestion
                and, for county, the default service-of-process distance,
                inline-editable since neither has an entry point elsewhere. */}
            {permissions.includes('manage_matters') && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-[var(--color-border)]">
                <div>
                  <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5 block">County</label>
                  <select
                    className="input text-sm"
                    defaultValue={matter.county || ''}
                    onBlur={(e) => e.target.value !== (matter.county || '') && saveCaseDetail('county', e.target.value || null)}
                  >
                    <option value="">Not set</option>
                    {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5 block">Claim Value (Ksh)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    defaultValue={matter.claim_value ?? ''}
                    placeholder="Optional"
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null
                      if (v !== (matter.claim_value ?? null)) saveCaseDetail('claim_value', v)
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Next Steps, a matter should always carry an owner and a
              direction; this sits above everything else on purpose. */}
          <SectionCard title="Next Steps" icon={ArrowRight} color="blue" defaultOpen>

            <p className="text-sm text-[var(--color-muted)] mb-3">Assign work for this matter. It will appear in <Link href="/admin/assignments" className="text-[var(--color-accent)] hover:underline">Assignments</Link> with full workflow tracking.</p>

            {/* This used to be a second, differently-shaped assignment form
                sitting on the same page as the lifecycle's "Assign Task".
                Both wrote the same row, so they're now one composer, opened
                from either place with the same inherited context. */}
            {permissions.includes('manage_matters') && (
              <button onClick={() => setShowAssign(true)} className="btn btn-primary gap-2 text-sm">
                <Plus className="w-4 h-4" /> Assign Work
              </button>
            )}
          </SectionCard>

          {/* Journey sections, visual order follows the matter's stage:
              vetting puts lifecycle + client first; an engaged matter puts
              time, billing, and documents first. */}
          <div className="flex flex-col">

          {/* Pre-matter intake history, one continuous pipeline: everything
              that happened on the submission before this matter existed,
              ticked, immediately followed by the matter's own Lifecycle
              card below, so the two read as a single line rather than two
              disconnected trackers. */}
          {matter.submission?.intake_stage && (
            <div style={{ order: 1 }}>
              <PipelineStepper
                submissionId={matter.submission.id}
                intakeStage={matter.submission.intake_stage}
                onAdvance={() => {}}
                team={team}
                submitterName={matter.submission.submitter_name}
              />
            </div>
          )}

          {/* Lifecycle, one continuous pipeline for the matter's whole
              life, click any reached step to see just that step's
              history, instead of everything dumped at once. */}
          <div style={{ order: 1.5 }}>
            <MatterPipeline
              status={matter.status}
              stageHistory={stageHistory}
              conflictChecks={conflictChecks}
              permissions={permissions}
              onConflictChanged={load}
              canMakeTransition={canMakeTransition}
              onTransitionClick={handleTransitionClick}
              submissionOrigin={matter.submission ? { id: matter.submission.id, tracking_code: matter.submission.tracking_code, created_at: matter.submission.created_at } : null}
              clientInstruction={matter.submission?.data?.message || matter.submission?.data?.description || null}
              description={matter.description || null}
              team={team}
              context={workContext}
              onAssignmentCreated={load}
              noteDraft={noteDraft}
              setNoteDraft={setNoteDraft}
              addingNote={addingNote}
              onAddNote={addNote}
              onInvokeService={() => setShowServicePanel(true)}
              onInvokeCostEstimate={() => setShowCostEstimate(true)}
            />
          </div>

          {/* Suggested Solutions, disabled for now, the suggestions were
              coming back unreliable, revisit once the matching logic is
              improved. */}
          {false && (
            <div style={{ order: 1.7 }}>
              <SuggestedSolutions
                matterType={matter?.type || ''}
                claimValue={matter?.claim_value ?? null}
                county={matter?.county ?? null}
                matterId={matter?.id || ''}
                onTaskAdded={load}
              />
            </div>
          )}

          {/* Cost Estimate, stays out of sight until there's an accepted
              cost on record or it's invoked as a stage-related task. */}
          <div style={{ order: preEngagement ? 2.5 : 2.2 }}>
            <CostEstimateCard matterId={matter.id} invoked={showCostEstimate} />
          </div>

          {/* Time and Billing, stays out of the way until the matter is
              engaged (or time has already been logged). */}
          {(!preEngagement || timeEntries.length > 0) && (
          <SectionCard
            title="Time and Billing"
            icon={Clock}
            color="gold"
            defaultOpen
            style={{ order: preEngagement ? 4 : 2 }}
            headerExtra={(() => {
              const unbilled = timeEntries.filter(e => !e.invoice_id && e.billable)
              const unbilledAmount = unbilled.reduce((s, e) => s + (e.minutes / 60) * Number(e.rate), 0)
              return (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Unbilled: <span className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(unbilledAmount)}</span>
                  </span>
                  {permissions.includes('manage_billing') && (
                    <button
                      onClick={generateInvoice}
                      disabled={generatingInvoice || unbilled.length === 0}
                      className="btn btn-primary gap-2 text-sm disabled:opacity-50"
                    >
                      {generatingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                      Generate Invoice
                    </button>
                  )}
                </div>
              )
            })()}
          >
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Log work as it happens, invoices are generated from unbilled time, so nothing is re-typed at billing.</p>

            {/* Log time inline */}
            {permissions.includes('log_time') && !['declined', 'archived'].includes(matter.status) && (
              <div className="flex flex-wrap gap-2 mb-4 items-end">
                <div className="flex-1 min-w-48">
                  <label className="label">Work done</label>
                  <input className="input text-sm" placeholder="e.g. Drafted plaint and reviewed exhibits" value={timeForm.description}
                    onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTimeEntry()} />
                </div>
                <div className="w-24">
                  <label className="label">Minutes</label>
                  <input type="number" min="1" className="input text-sm" placeholder="60" value={timeForm.minutes}
                    onChange={e => setTimeForm(f => ({ ...f, minutes: e.target.value }))} />
                </div>
                <div className="w-28">
                  <label className="label">Rate (KES/hr)</label>
                  <input type="number" min="0" className="input text-sm" placeholder="0" value={timeForm.rate}
                    onChange={e => setTimeForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
                <div className="w-36">
                  <label className="label">Date</label>
                  <input type="date" className="input text-sm" value={timeForm.entry_date}
                    onChange={e => setTimeForm(f => ({ ...f, entry_date: e.target.value }))} />
                </div>
                <button onClick={addTimeEntry} disabled={addingTime} className="btn btn-outline gap-2 text-sm">
                  {addingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Log
                </button>
              </div>
            )}

            {/* Entries */}
            {timeEntries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] py-2">No time logged on this matter yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-2">
                {timeEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--color-text-primary)]">{entry.description}</div>
                      <div className="text-xs text-[var(--color-muted)]">
                        {formatDate(entry.entry_date, 'short')} · {entry.author?.full_name || 'Unknown'} · {formatMinutes(entry.minutes)} @ {formatCurrency(Number(entry.rate))}/hr
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {formatCurrency((entry.minutes / 60) * Number(entry.rate))}
                      </span>
                      {entry.invoice_id ? (
                        <span className="badge status-completed text-xs">Billed</span>
                      ) : (
                        permissions.includes('log_time') && (
                          <button onClick={() => deleteTimeEntry(entry.id)} className="btn btn-ghost p-1 !px-1" title="Remove entry">
                            <Trash2 className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Invoices on this matter */}
            {invoices.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">Invoices</div>
                <div className="flex flex-col gap-1.5">
                  {invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{inv.invoice_number}</span>
                        <span className={`badge ${INVOICE_STATUS_BADGE[inv.status]} text-xs`}>{invoiceStatusLabel(inv.status)}</span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {inv.issued_at ? `Issued ${formatDate(inv.issued_at, 'short')}` : `Created ${formatDate(inv.created_at, 'short')}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(Number(inv.total))}</span>
                        {permissions.includes('manage_billing') && availableInvoiceTransitions(inv.status).map(to => (
                          <button key={to} onClick={() => invoiceTransition(inv.id, to)}
                            className={`btn text-xs ${to === 'void' ? 'btn-ghost text-red-500' : 'btn-outline'}`}>
                            {to === 'sent' ? 'Mark Sent' : to === 'paid' ? 'Mark Paid' : 'Void'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
          )}

          {/* Billing Workspace - aggregated view of estimated, approved, and invoiced work */}
          <div style={{ order: 2.1 }}>
            <MatterBillingWorkspace matterId={matter.id} />
          </div>

          {/* Documents */}
          <SectionCard title={`Documents (${docs.length})`} icon={FileText} color="slate" defaultOpen style={{ order: 3 }}
            headerExtra={
              <div className="flex items-center gap-2 flex-wrap">
                <DocumentTemplateLauncher matterId={matter.id} matterType={matter.type} onCreated={load} />
                <button onClick={() => setShowUpload(true)} className="btn btn-primary gap-2 text-sm">
                  <Upload className="w-4 h-4" /> Upload Document
                </button>
              </div>
            }
          >
            {docs.length === 0 ? (
              <div className="card p-10 text-center text-[var(--color-muted)]">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map(doc => (
                  <div key={doc.id} className="card p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-md bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[var(--color-accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{doc.title}</div>
                          <div className="text-xs text-[var(--color-muted)]">{doc.file_name} · {formatFileSize(doc.file_size)}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.is_privileged && <span title="Privileged"><Shield className="w-3.5 h-3.5 text-red-500" /></span>}
                          <span className={`badge ${accessLevelColor[doc.access_level] || 'status-pending'} text-xs`}>{doc.access_level}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-muted)]">
                        <span>{DOCUMENT_TYPES.find(d => d.value === doc.type)?.label || doc.type}</span>
                        <span>·</span>
                        <span>{doc.uploader?.full_name || 'Unknown'}</span>
                        <span>·</span>
                        <span>{formatDate(doc.created_at, 'short')}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="btn btn-ghost text-xs py-1 gap-1.5">
                          <Eye className="w-3 h-3" /> View
                        </a>
                        <a href={doc.file_url} download={doc.file_name}
                          className="btn btn-ghost text-xs py-1 gap-1.5">
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Service of Process, stays out of sight until there's a
              record to show or it's invoked as a stage-related task. */}
          <div style={{ order: 3.5 }}>
            <ServiceOfProcessCard
              matterId={matter.id}
              documents={docs.map(d => ({ id: d.id, title: d.title }))}
              permitted={permissions.includes('manage_matters')}
              invoked={showServicePanel}
            />
          </div>

          </div>{/* end journey sections */}

          {/* Case Diary, the chronological record of the matter, the
              term advocates already use for a file's running history.
              Notes, documents, invoices, and client communication only;
              conflict checks, stage transitions, the client's instruction,
              and the summary of facts all live in the Lifecycle pipeline's
              Summary view above instead of being repeated here. Only the
              current milestone is expanded; the past stays one click away. */}
          <SectionCard title="Case Diary" icon={History} color="slate">
            <p className="text-xs text-[var(--color-text-muted)] mb-5">The matter's running record since the client first reached out, filed under each milestone.</p>

            {/* Record an attendance note under the current milestone */}
            {permissions.includes('manage_matters') && (
              <div className="flex gap-2 mb-5">
                <input className="input text-sm flex-1"
                  placeholder="Record what was done or decided, it files under the current milestone…"
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button onClick={addNote} disabled={addingNote} className="btn btn-outline gap-2 text-sm flex-shrink-0">
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Attendance Note
                </button>
              </div>
            )}

            {/* Milestones, latest first */}
            <div className="flex flex-col gap-2">
              {[...storySegments].reverse().map((seg, idx) => (
                <details key={seg.start} open={idx === 0} className="rounded-lg border border-[var(--color-border)]">
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer flex-wrap hover:bg-[var(--color-surface-overlay)] rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <span className={`badge ${getStatusColor(seg.stage)} text-xs`}>{stageMeta(seg.stage).label}</span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {formatDate(seg.start, 'short')}, {seg.end ? formatDate(seg.end, 'short') : 'now'}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-muted)]">
                      {seg.events.length} event{seg.events.length === 1 ? '' : 's'}{seg.minutes > 0 ? ` · ${formatMinutes(seg.minutes)} logged` : ''}
                    </span>
                  </summary>
                  <div className="px-4 pb-3 flex flex-col gap-1.5">
                    {seg.events.length === 0 && seg.minutes === 0 ? (
                      <p className="text-xs text-[var(--color-muted)] py-1">Nothing recorded during this milestone.</p>
                    ) : (
                      <>
                        {seg.events.map((e, i) => (
                          <div key={i} className="flex items-start gap-3 py-1.5 text-sm border-t border-[var(--color-border)] first:border-t-0 pt-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent)] flex-shrink-0 mt-0.5 w-24">{e.kind}</span>
                            <span className="text-[var(--color-text-secondary)] flex-1 min-w-0">{e.text}</span>
                            <span className="text-xs text-[var(--color-muted)] flex-shrink-0">
                              {e.by ? `${e.by} · ` : ''}{formatDate(e.date, 'short')}
                            </span>
                          </div>
                        ))}
                        {seg.minutes > 0 && (
                          <div className="flex items-start gap-3 py-1.5 text-sm border-t border-[var(--color-border)] pt-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent)] flex-shrink-0 mt-0.5 w-24">Work</span>
                            <span className="text-[var(--color-text-secondary)]">{formatMinutes(seg.minutes)} logged during this milestone</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </SectionCard>

          {/* Revisions */}
          {revisions.length > 0 && (
            <SectionCard title="Revisions" icon={History} color="slate">
              <div className="flex flex-col gap-3">
                {revisions.map((rev) => (
                  <div key={rev.id} className="text-xs border-l-2 border-[var(--color-border)] pl-3">
                    <div className="text-[var(--color-text-secondary)] font-medium line-clamp-1">{rev.data.title || 'Untitled at this point'}</div>
                    <div className="text-[var(--color-muted)]">
                      {formatDate(rev.created_at)}{rev.author?.full_name ? ` · ${rev.author.full_name}` : ''}
                    </div>
                    {rev.note && <div className="text-[var(--color-muted)] italic mt-0.5">{rev.note}</div>}
                    <button
                      onClick={() => restoreRevision(rev.id)}
                      disabled={restoring === rev.id}
                      className="text-[var(--color-accent)] hover:underline mt-1"
                    >
                      {restoring === rev.id ? 'Restoring…' : 'Restore this version'}
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Upload Modal */}
          {showUpload && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
              <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
                <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)] mb-5">Upload Document</h2>
                <div className="flex flex-col gap-4">
                  {/* File picker */}
                  <div
                    className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-[var(--color-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {selectedFile ? selectedFile.name : 'Click to select file'}
                    </p>
                    <input ref={fileRef} type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Document Title *</label>
                      <input className="input text-sm" value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Document Type</label>
                      <select className="input text-sm" value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}>
                        {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Access Level</label>
                      <select className="input text-sm" value={uploadForm.access_level} onChange={e => setUploadForm(f => ({ ...f, access_level: e.target.value }))}>
                        {['public', 'client', 'staff', 'admin', 'confidential'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Tags</label>
                      <input className="input text-sm" value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} placeholder="tag1, tag2" />
                    </div>
                  </div>

                  <div>
                    <label className="label">Description</label>
                    <textarea rows={2} className="input text-sm" value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={uploadForm.is_privileged} onChange={e => setUploadForm(f => ({ ...f, is_privileged: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">Attorney-client privileged document</span>
                  </label>

                  <div className="flex gap-3">
                    <button onClick={uploadDocument} disabled={uploading} className="btn btn-primary flex-1 gap-2">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload
                    </button>
                    <button onClick={() => setShowUpload(false)} className="btn btn-ghost flex-1">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <AssignmentComposer
            open={showAssign}
            onClose={() => setShowAssign(false)}
            context={workContext}
            team={team}
            suggestions={stageTaskSuggestions(matter.status)}
            title={`Assign work on ${matter.matter_number}`}
            onCreated={load}
          />
        </>
      ) : (
        <div className="card p-12 text-center text-[var(--color-muted)]">Matter not found.</div>
      )}
    </div>
  )
}
