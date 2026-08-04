'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X, Play, Send, MessageCircle, AlertCircle, FileUp, Loader2, Paperclip, Link2 } from 'lucide-react'
import SectionCard from '@/components/admin/SectionCard'
import AssignmentMessages from '@/components/assignments/AssignmentMessages'
import MatterTimelineStrip from '@/components/assignments/MatterTimelineStrip'
import DocumentTemplateLauncher from '@/components/admin/DocumentTemplateLauncher'
import toast from 'react-hot-toast'

interface AssignmentBrief {
  objective: string
  background: string
  currentStage: string
  expectedDeliverable: string
  instructions: string | null
}

interface Assignment {
  id: string
  matter_id: string | null
  submission_id?: string | null
  status: string
  assigned_by: string
  assigned_to: string | null
  instructions: string
  stage_key: string | null
  due_date?: string | null
  currentStageLabel?: string | null
  priority?: 'overdue' | 'due_soon' | 'normal' | 'none'
  brief?: AssignmentBrief
  assigned_at: string
  accepted_at?: string
  started_at?: string
  submitted_at?: string
  rejection_reason?: string
  matter?: {
    id: string; matter_number: string; title: string; type?: string; status?: string
    description?: string | null; client_name?: string; opposing_party?: string | null
    court?: string | null; case_number?: string | null; county?: string | null
    claim_value?: number | null; is_confidential?: boolean; opening_date?: string
    assigned_attorney?: { full_name: string; position?: string } | null
  }
  assignee?: { id: string; full_name: string; position?: string }
  work_item?: { id: string; title: string; instructions?: string | null; activity_type?: { name: string } | null } | null
  assigned_by_user?: { full_name: string }
  messages?: Array<{
    id: string
    sender_id: string
    message_type: 'Comment' | 'Review' | 'System' | 'Decision'
    content: string
    created_at: string
  }>
  matterStageHistory?: Array<{ from_stage: string | null; to_stage: string; created_at: string; actor?: { full_name: string } | null }>
  /** Every document on the matter, the "Related Documents" section. */
  matterDocuments?: Array<{ id: string; title: string; type: string; file_url: string; file_name: string; assignment_id?: string | null; created_at: string; uploader?: { full_name: string } | null }>
  /** The subset of matterDocuments (or, pre-matter, submission-linked docs) uploaded specifically via this assignment. */
  assignmentDocuments?: Array<{ id: string; title: string; type: string; file_url: string; file_name: string; created_at: string; uploader?: { full_name: string } | null }>
  assignedTeam?: Array<{ role: string; profile?: { full_name: string } | null }>
  conflictChecks?: Array<{ id: string; search_query: string; highest_risk: string | null; decision: string; decision_notes: string | null; created_at: string }>
  submission?: {
    id: string; tracking_code: string; type: string; submitter_name: string; submitter_email?: string
    data: Record<string, string>; intake_stage: string | null; created_at: string
    updates?: Array<{ status: string; message: string; is_public: boolean; created_at: string }>
  } | null
  _stageAdvanced?: {
    advanced: boolean
    from?: string
    to?: string
    reason?: 'stale' | 'gates_unmet' | 'end_of_path'
    unmetGates?: string[]
  } | null
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-800' },
  due_soon: { label: 'Due soon', color: 'bg-amber-100 text-amber-800' },
  normal: { label: 'Normal', color: 'bg-slate-100 text-slate-700' },
  none: { label: 'No due date', color: 'bg-slate-100 text-slate-500' },
}

export default function AssignmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [message, setMessage] = useState('')
  const [showRejectionForm, setShowRejectionForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [showReassignForm, setShowReassignForm] = useState(false)
  const [reassignOption, setReassignOption] = useState<'return' | 'assign' | 'claim' | 'cancel' | null>(null)
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [reassignMessage, setReassignMessage] = useState('')
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; is_eligible: boolean; ineligible_reason: string | null }>>([])
  const [reassigning, setReassigning] = useState(false)
  const [sendingToClient, setSendingToClient] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentTeamMemberId, setCurrentTeamMemberId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [responseLink, setResponseLink] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadAssignment = async () => {
      try {
        const [assignRes, meRes, deskRes] = await Promise.all([
          fetch(`/api/assignments/${params.id}`),
          fetch('/api/me'),
          fetch('/api/desk/overview'),
        ])

        let loadedAssignment: Assignment | null = null
        if (assignRes.ok) {
          loadedAssignment = await assignRes.json()
          setAssignment(loadedAssignment)
        }

        if (meRes.ok) {
          const me = await meRes.json()
          setCurrentUserRole(me.role)
          setCurrentUserId(me.id)
        }

        // assignment.assigned_to is a team_members.id, not a profiles.id,
        // so "am I the assignee" needs the team member record for the
        // signed-in person, not their profile id, /api/desk/overview
        // already resolves it for the same person's own desk.
        if (deskRes.ok) {
          const desk = await deskRes.json()
          setCurrentTeamMemberId(desk?.teamMember?.id || null)
        }

        // Available assignees are scoped to the assignment's own matter (so
        // clients on that matter are correctly flagged ineligible), not to
        // the assignment's own id, only fetch once we know it.
        const matterParam = loadedAssignment?.matter_id ? `?matter_id=${loadedAssignment.matter_id}` : ''
        const teamRes = await fetch(`/api/assignments/available-assignees${matterParam}`)
        if (teamRes.ok) {
          const data = await teamRes.json()
          setTeamMembers(data.assignees || [])
        }
      } catch (error) {
        console.error('Failed to load assignment:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAssignment()
  }, [params.id])

  // Re-fetches just the assignment record, used after creating a working
  // copy from a template so "Related documents" picks up the new file
  // without re-running the full initial load (me, desk, assignees).
  const refreshAssignment = async () => {
    const res = await fetch(`/api/assignments/${params.id}`)
    if (res.ok) setAssignment(await res.json())
  }

  const handleAction = async (action: string, messageOverride?: string) => {
    setActing(true)
    try {
      const res = await fetch(`/api/assignments/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          message: (messageOverride ?? message) || undefined,
          rejection_reason: rejectionReason || undefined,
        }),
      })

      if (res.ok) {
        const updated: Assignment = await res.json()
        setAssignment(updated)
        setMessage('')
        setRejectionReason('')
        setShowRejectionForm(false)
        // The workflow completion engine may have just advanced the matter
        // (or the intake pipeline) as a result of this approval, say so
        // rather than leaving it to be noticed on the matter page later. If
        // it didn't advance because a gate is still unmet, say that too,
        // approving looking like it silently did nothing is worse.
        const advance = updated._stageAdvanced
        if (advance?.advanced) {
          toast.success(`Stage requirements met, moved from "${advance.from}" to "${advance.to}"`)
        } else if (advance?.reason === 'gates_unmet' && advance.unmetGates?.length) {
          toast(`Approved, but the stage can't advance yet: ${advance.unmetGates.join(', ')}`, { icon: '⏳' })
        }
      }
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setActing(false)
    }
  }

  // The submission-only "handle this step" path: the written response IS
  // the work, not an attachment alongside it, so it's sent as the submit
  // action's message directly rather than routed through the generic
  // comment box.
  const submitStepResponse = async () => {
    if (!responseText.trim()) return
    setActing(true)
    try {
      const content = responseText.trim() + (responseLink.trim() ? `\n\n${responseLink.trim()}` : '')
      const res = await fetch(`/api/assignments/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', message: content }),
      })
      if (res.ok) {
        const updated: Assignment = await res.json()
        setAssignment(updated)
        setResponseText('')
        setResponseLink('')
      }
    } catch (error) {
      console.error('Submit failed:', error)
    } finally {
      setActing(false)
    }
  }

  const handleReassign = async () => {
    if (!reassignOption) return

    setReassigning(true)
    try {
      const body: Record<string, any> = {
        message: reassignMessage || undefined,
      }

      if (reassignOption === 'return') {
        body.return_to_assignee = true
      } else if (reassignOption === 'assign') {
        body.assign_to = selectedAssignee
      } else if (reassignOption === 'claim') {
        body.claim = true
      } else if (reassignOption === 'cancel') {
        body.cancel = true
      }

      const res = await fetch(`/api/assignments/${params.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const updated = await res.json()
        setAssignment(updated)
        setShowReassignForm(false)
        setReassignOption(null)
        setSelectedAssignee('')
        setReassignMessage('')
      }
    } catch (error) {
      console.error('Reassign failed:', error)
    } finally {
      setReassigning(false)
    }
  }

  const handleSendToClient = async () => {
    setSendingToClient(true)
    try {
      const res = await fetch(`/api/assignments/${params.id}/send-to-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const result = await res.json()
        // Reload assignment to reflect update
        const updatedRes = await fetch(`/api/assignments/${params.id}`)
        if (updatedRes.ok) {
          setAssignment(await updatedRes.json())
        }
        alert(result.message || 'Work sent to client successfully')
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Send to client failed:', error)
      alert('Failed to send to client')
    } finally {
      setSendingToClient(false)
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/assignments/${params.id}/documents`, { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('Attached')
        const updatedRes = await fetch(`/api/assignments/${params.id}`)
        if (updatedRes.ok) setAssignment(await updatedRes.json())
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not attach the file')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  }

  if (!assignment) {
    return <div className="text-center py-20 text-[var(--color-muted)]">Assignment not found</div>
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    Assigned: { color: 'bg-blue-100 text-blue-800', label: 'Assigned' },
    Accepted: { color: 'bg-blue-100 text-blue-800', label: 'Accepted' },
    'In Progress': { color: 'bg-amber-100 text-amber-800', label: 'In Progress' },
    Submitted: { color: 'bg-purple-100 text-purple-800', label: 'Pending Review' },
    Approved: { color: 'bg-emerald-100 text-emerald-800', label: 'Approved' },
    Rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    Revoked: { color: 'bg-slate-100 text-slate-700', label: 'Revoked' },
  }

  const config = statusConfig[assignment.status] || statusConfig.Assigned
  // Backend enforces these exactly this strictly (no admin bypass on
  // either check), the buttons need to match or they invite an action
  // that will just come back 403.
  const isAssignee = !!currentTeamMemberId && assignment.assigned_to === currentTeamMemberId
  const isAssigner = !!currentUserId && assignment.assigned_by === currentUserId

  return (
    <div className="max-w-5xl mx-auto px-2 md:px-4">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--color-accent)] hover:underline mb-4"
        >
          ← Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
              {assignment.work_item?.title || assignment.matter?.title || assignment.instructions || 'Assignment'}
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {assignment.matter?.matter_number || (assignment.submission ? `Enquiry ${assignment.submission.tracking_code}` : 'Standalone work')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {assignment.priority && assignment.priority !== 'none' && (
              <span className={`badge text-sm ${PRIORITY_CONFIG[assignment.priority].color}`}>
                {PRIORITY_CONFIG[assignment.priority].label}
              </span>
            )}
            <span className={`badge ${config.color} text-sm`}>{config.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Summary */}
          <SectionCard title="Assignment Summary" color="blue" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Assigned to</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1">
                  {assignment.assignee?.full_name || 'Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Assigned by</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1">
                  {assignment.assigned_by_user?.full_name || 'System'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Assigned date</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1 text-sm">
                  {new Date(assignment.assigned_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Due date</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1 text-sm">
                  {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Status</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.status}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Current stage</p>
                <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.currentStageLabel || '—'}</p>
              </div>
            </div>

            {assignment.rejection_reason && (
              <div className="mt-6 pt-6 border-t border-[var(--color-border)] bg-red-50 p-4 rounded border border-red-200">
                <p className="text-xs text-red-700 uppercase tracking-wide font-medium mb-2">Rejection reason</p>
                <p className="text-sm text-red-800">{assignment.rejection_reason}</p>
              </div>
            )}
          </SectionCard>

          {/* Assignment Brief: objective/background/deliverable are always
              derived from the matter, stage, and (if this executes a work
              item) the activity type, the assigner only ever wrote the
              instructions line at the bottom. */}
          {assignment.brief && (
            <SectionCard title="Assignment Brief" color="gold" defaultOpen={true}>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-1">Objective</p>
                  <p className="text-sm text-[var(--color-text-primary)]">{assignment.brief.objective}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-1">Background</p>
                  <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{assignment.brief.background}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-1">Expected deliverable</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{assignment.brief.expectedDeliverable}</p>
                </div>
                {assignment.brief.instructions && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-1">Instructions from {assignment.assigned_by_user?.full_name || 'the assigner'}</p>
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{assignment.brief.instructions}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Matter Timeline: read-only position within the lifecycle, not
              the interactive stepper the matter/enquiry's own page renders. */}
          {assignment.stage_key && (
            <SectionCard title="Matter Timeline" color="slate" defaultOpen={false}>
              <MatterTimelineStrip stageKey={assignment.stage_key} isMatter={!!assignment.matter_id} />
            </SectionCard>
          )}

          {/* Case File, handing over the whole context, not just the task:
              matter background if there is one, the client's own request,
              and everything that's happened on it so far, so whoever picks
              this up isn't working blind. */}
          {assignment.matter && (
            <SectionCard
              title="Matter Context"
              color="purple"
              defaultOpen={true}
              headerExtra={
                <DocumentTemplateLauncher
                  matterId={assignment.matter.id}
                  matterType={assignment.matter.type || 'other'}
                  onCreated={refreshAssignment}
                />
              }
            >
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Client</p>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.matter.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Matter status</p>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1 capitalize">{assignment.matter.status?.replace(/_/g, ' ')}</p>
                </div>
                {assignment.matter.type && (
                  <div>
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Matter type</p>
                    <p className="font-medium text-[var(--color-text-primary)] mt-1 capitalize">{assignment.matter.type.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {assignment.matter.assigned_attorney && (
                  <div>
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Assigned advocate</p>
                    <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.matter.assigned_attorney.full_name}</p>
                  </div>
                )}
                {assignment.matter.opposing_party && (
                  <div>
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Opposing party</p>
                    <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.matter.opposing_party}</p>
                  </div>
                )}
                {assignment.matter.court && (
                  <div>
                    <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Court</p>
                    <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.matter.court}{assignment.matter.case_number ? ` · ${assignment.matter.case_number}` : ''}</p>
                  </div>
                )}
              </div>
              {assignment.matter.description && (
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Description</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{assignment.matter.description}</p>
                </div>
              )}

              {assignment.matterStageHistory && assignment.matterStageHistory.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Matter history</p>
                  <div className="flex flex-col gap-1.5">
                    {assignment.matterStageHistory.map((h, i) => (
                      <div key={i} className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                        <span className="text-[var(--color-muted)]">{new Date(h.created_at).toLocaleDateString()}</span>
                        <span>{h.from_stage ? `${h.from_stage} → ${h.to_stage}` : `Opened at ${h.to_stage}`}</span>
                        {h.actor?.full_name && <span className="text-[var(--color-muted)]">· {h.actor.full_name}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assignment.conflictChecks && assignment.conflictChecks.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Conflict checks</p>
                  {assignment.conflictChecks.map(c => (
                    <div key={c.id} className="text-xs text-[var(--color-text-secondary)] mb-1">
                      &quot;{c.search_query}&quot;, <span className="capitalize">{c.decision.replace(/_/g, ' ')}</span>
                      {c.decision_notes && <span className="text-[var(--color-muted)]"> ({c.decision_notes})</span>}
                    </div>
                  ))}
                </div>
              )}

              {assignment.assignedTeam && assignment.assignedTeam.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Assigned team</p>
                  <div className="flex flex-wrap gap-1.5">
                    {assignment.assignedTeam.filter(p => p.profile?.full_name).map((p, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] capitalize">
                        {p.profile!.full_name} · {p.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Documents: every document already on the matter,
                  automatically shown, not something the assigner has to
                  attach by hand. Assignment-specific deliverables are their
                  own section below so the two don't get confused. */}
              {assignment.matterDocuments && assignment.matterDocuments.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Related documents</p>
                  <div className="space-y-1.5">
                    {assignment.matterDocuments.map(doc => (
                      <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] hover:text-[var(--color-accent)]">
                        <FileUp className="w-3.5 h-3.5 flex-shrink-0" /> {doc.title || doc.file_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Where this came from: the client's original request and
              everything staff have told them since, same context a paper
              file would carry with it. */}
          {assignment.submission && (
            <SectionCard title="Client Enquiry" color="green" defaultOpen={!assignment.matter}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Submitter</p>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1">{assignment.submission.submitter_name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide">Tracking code</p>
                  <p className="font-medium text-[var(--color-text-primary)] mt-1 font-mono text-xs">{assignment.submission.tracking_code}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {Object.entries(assignment.submission.data || {}).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-[var(--color-muted)] uppercase tracking-wide capitalize col-span-1">{key.replace(/_/g, ' ')}</div>
                    <div className="text-[var(--color-text-secondary)] col-span-2 whitespace-pre-wrap">{String(value)}</div>
                  </div>
                ))}
              </div>
              {assignment.submission.updates && assignment.submission.updates.length > 0 && (
                <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">Status history</p>
                  <div className="flex flex-col gap-1.5">
                    {assignment.submission.updates.map((u, i) => (
                      <div key={i} className="text-xs text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-muted)]">{new Date(u.created_at).toLocaleDateString()}</span>: {u.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Assignment Documents: specifically what's been attached to
              this piece of work (legal_documents rows tagged assignment_id),
              separate from Related Documents above so "what did this
              assignment produce" stays distinguishable from "what does the
              matter already have". */}
          {assignment.assignmentDocuments && assignment.assignmentDocuments.length > 0 && (
            <SectionCard title="Assignment Documents" color="slate" defaultOpen={true}>
              <div className="space-y-2">
                {assignment.assignmentDocuments.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] rounded-lg transition-colors group"
                  >
                    <FileUp className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
                    <span className="text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] truncate">
                      {doc.title || doc.file_name}
                    </span>
                  </a>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Messages */}
          <AssignmentMessages
            messages={
              assignment.messages?.map(m => ({
                ...m,
                senderName: m.sender_id === assignment.assigned_by ? assignment.assigned_by_user?.full_name : assignment.assignee?.full_name,
              })) || []
            }
            canComment={true}
            onSendMessage={async (content) => {
              setMessage(content)
              await handleAction('comment')
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action buttons */}
          <SectionCard title="Actions" color="green" defaultOpen={true}>
            <div className="space-y-2.5">
              {/* For the assignee only, the backend rejects these from
                  anyone else, including an admin who isn't the assignee. */}
              {isAssignee && assignment.status === 'Assigned' && (
                <button
                  onClick={() => handleAction('accept')}
                  disabled={acting}
                  className="btn btn-primary w-full"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept'}
                </button>
              )}

              {isAssignee && assignment.status === 'Accepted' && (
                <button
                  onClick={() => handleAction('start')}
                  disabled={acting}
                  className="btn btn-primary w-full gap-2"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start work
                </button>
              )}

              {/* A submission-only assignment (no matter yet) is almost
                  always "record what happened at this step" (a conflict
                  search result, what the client instructed, the opinion
                  given), not a document deliverable, so the primary action
                  is writing that down, not attaching a file. Matter work
                  keeps the document-centric flow, that's where a real
                  deliverable (a draft, a filed document) belongs. */}
              {isAssignee && assignment.status === 'In Progress' && !assignment.matter_id && (
                <div className="space-y-2">
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="What did you find / what happened at this step…"
                    className="input text-sm resize-none w-full"
                    rows={4}
                  />
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" />
                    <input
                      type="url"
                      value={responseLink}
                      onChange={e => setResponseLink(e.target.value)}
                      placeholder="Add a link (optional)"
                      className="input text-sm w-full pl-8"
                    />
                  </div>
                  <button
                    onClick={() => submitStepResponse()}
                    disabled={acting || !responseText.trim()}
                    className="btn btn-primary w-full gap-2"
                  >
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit
                  </button>
                </div>
              )}

              {isAssignee && assignment.status === 'In Progress' && assignment.matter_id && (
                <>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-secondary w-full gap-2"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    Attach a document
                  </button>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" />
                    <input
                      type="url"
                      value={responseLink}
                      onChange={e => setResponseLink(e.target.value)}
                      placeholder="Add a link (optional)"
                      className="input text-sm w-full pl-8"
                    />
                  </div>
                  <button
                    onClick={() => {
                      handleAction('submit', responseLink.trim())
                      setResponseLink('')
                    }}
                    disabled={acting}
                    className="btn btn-primary w-full gap-2"
                  >
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit work
                  </button>
                </>
              )}

              {!isAssignee && ['Assigned', 'Accepted', 'In Progress'].includes(assignment.status) && (
                <p className="text-sm text-[var(--color-muted)]">
                  Waiting on {assignment.assignee?.full_name || 'the assignee'} to {assignment.status === 'Assigned' ? 'accept this' : assignment.status === 'Accepted' ? 'start this' : 'submit this'}.
                </p>
              )}

              {/* For the assigner only, same reasoning: the backend has no
                  admin bypass on approve/reject, only whoever created it. */}
              {isAssigner && assignment.status === 'Submitted' && (
                <>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={acting}
                    className="btn btn-primary w-full gap-2"
                  >
                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectionForm(!showRejectionForm)}
                    className="btn btn-secondary w-full gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}

              {!isAssigner && assignment.status === 'Submitted' && (
                <p className="text-sm text-[var(--color-muted)]">
                  Submitted, waiting on {assignment.assigned_by_user?.full_name || 'the assigner'} to review it.
                </p>
              )}

              {/* Send to Client - Only for assigner when approved */}
              {assignment.status === 'Approved' && isAssigner && (
                <button
                  onClick={handleSendToClient}
                  disabled={sendingToClient}
                  className="btn btn-primary w-full gap-2"
                >
                  {sendingToClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to Client
                </button>
              )}

              {showRejectionForm && (
                <div className="p-3 bg-red-50 border border-red-200 rounded space-y-2">
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Explain what needs to be revised..."
                    className="input text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('reject')}
                      disabled={!rejectionReason.trim() || acting}
                      className="btn btn-small bg-red-600 text-white hover:bg-red-700 flex-1"
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send rejection'}
                    </button>
                    <button
                      onClick={() => setShowRejectionForm(false)}
                      className="btn btn-small btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Reassignment for rejected/revoked, assigner only, the
                  backend's reassign endpoint rejects anyone else. */}
              {isAssigner && (assignment.status === 'Rejected' || assignment.status === 'Revoked') && !showReassignForm && (
                <button
                  onClick={() => setShowReassignForm(true)}
                  className="btn btn-secondary w-full"
                >
                  Reassign this work
                </button>
              )}

              {isAssigner && showReassignForm && (assignment.status === 'Rejected' || assignment.status === 'Revoked') && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded space-y-3">
                  <p className="font-medium text-sm text-amber-900">Choose what to do with this assignment:</p>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reassign-option"
                        value="return"
                        checked={reassignOption === 'return'}
                        onChange={() => setReassignOption('return')}
                      />
                      <span className="text-sm text-amber-900">Send back for corrections (returns to the same person, with your feedback)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reassign-option"
                        value="assign"
                        checked={reassignOption === 'assign'}
                        onChange={() => setReassignOption('assign')}
                      />
                      <span className="text-sm text-amber-900">Assign to someone else</span>
                    </label>

                    {reassignOption === 'assign' && (
                      <select
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        className="input text-sm w-full ml-6"
                      >
                        <option value="">-- Select team member --</option>
                        {teamMembers.map((tm) => (
                          <option key={tm.id} value={tm.id} disabled={!tm.is_eligible}>
                            {tm.full_name}
                            {!tm.is_eligible ? ` (${tm.ineligible_reason})` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reassign-option"
                        value="claim"
                        checked={reassignOption === 'claim'}
                        onChange={() => setReassignOption('claim')}
                      />
                      <span className="text-sm text-amber-900">I&apos;ll amend it myself</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reassign-option"
                        value="cancel"
                        checked={reassignOption === 'cancel'}
                        onChange={() => setReassignOption('cancel')}
                      />
                      <span className="text-sm text-amber-900">Cancel assignment</span>
                    </label>
                  </div>

                  <textarea
                    value={reassignMessage}
                    onChange={(e) => setReassignMessage(e.target.value)}
                    placeholder="Optional: Add a note about this reassignment..."
                    className="input text-sm resize-none w-full"
                    rows={2}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={handleReassign}
                      disabled={!reassignOption || (reassignOption === 'assign' && !selectedAssignee) || reassigning}
                      className="btn btn-primary flex-1"
                    >
                      {reassigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                    </button>
                    <button
                      onClick={() => {
                        setShowReassignForm(false)
                        setReassignOption(null)
                        setSelectedAssignee('')
                        setReassignMessage('')
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Timeline" color="slate" defaultOpen={false}>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-[var(--color-muted)] uppercase">Assigned</p>
                <p className="text-[var(--color-text-primary)] mt-1">
                  {new Date(assignment.assigned_at).toLocaleDateString()}
                </p>
              </div>
              {assignment.accepted_at && (
                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase">Accepted</p>
                  <p className="text-[var(--color-text-primary)] mt-1">
                    {new Date(assignment.accepted_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {assignment.started_at && (
                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase">Started</p>
                  <p className="text-[var(--color-text-primary)] mt-1">
                    {new Date(assignment.started_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {assignment.submitted_at && (
                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-muted)] uppercase">Submitted</p>
                  <p className="text-[var(--color-text-primary)] mt-1">
                    {new Date(assignment.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
