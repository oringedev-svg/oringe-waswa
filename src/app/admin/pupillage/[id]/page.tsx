'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, FileText, Upload,
  ShieldCheck, AlertTriangle, GraduationCap, Download, Loader2,
  UserCheck, BookOpen, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { StatusPill, LoadingState, type Tone } from '@/components/admin/ui'

// ── Types ───────────────────────────────────────────────────
interface ChecklistItem {
  id: string
  document_type: string
  is_required: boolean
  is_applicable: boolean
  file_url: string | null
  file_name: string | null
  auto_satisfied: boolean
  status: string
  verified_at: string | null
}

interface WorkbookEntry {
  id: string
  entry_date: string
  description: string
  practice_area: string | null
  hours_spent: number | null
  supervisor_signed_off: boolean
  is_locked: boolean
}

interface PupilEvent {
  id: string
  type: string
  detail: string
  actor: { full_name: string } | null
  created_at: string
}

interface Application {
  id: string
  status: string
  pupil_full_name: string
  pupil_email: string
  pupil_phone: string | null
  pupil_id_number: string | null
  pupil_dob: string | null
  pupil_gender: string | null
  pupil_postal_address: string | null
  pupil_ksl_admission_no: string | null
  pupil_atp_intake: string | null
  pupil_university: string | null
  pupil_llb_completion_date: string | null
  pupil_kra_pin: string | null
  pupil_bank_name: string | null
  pupil_bank_branch: string | null
  pupil_bank_account: string | null
  pupil_mobile_money_no: string | null
  pupil_next_of_kin_name: string | null
  pupil_next_of_kin_phone: string | null
  pupil_next_of_kin_relationship: string | null
  pupil_special_needs: boolean
  pupil_special_needs_notes: string | null
  term_start_date: string | null
  term_end_date: string | null
  monthly_stipend: number | null
  stipend_payment_day: number | null
  other_facilities: string | null
  practice_rotations: { area: string; duration_months: number; order: number }[]
  eligibility_checked_at: string | null
  eligibility_result: { passed: boolean; checks: { name: string; passed: boolean; detail: string }[] } | null
  deed_generated_at: string | null
  deed_file_url: string | null
  onboarded_at: string | null
  created_at: string
  pupil_master: {
    id: string
    lsk_membership_no: string
    years_of_practice: number
    current_pc_no: string | null
    pc_valid_to: string | null
    team_member: { id: string; full_name: string; email: string; phone: string | null; position: string }
  }
  centre: { id: string; firm_name: string; physical_address: string | null } | null
  checklist: ChecklistItem[]
  events: PupilEvent[]
  workbook: WorkbookEntry[]
}

const PIPELINE_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'eligibility_check', label: 'Eligibility' },
  { key: 'particulars_review', label: 'Particulars' },
  { key: 'deed_generated', label: 'Deed' },
  { key: 'documents_pending', label: 'Documents' },
  { key: 'ready_for_signature', label: 'Signatures' },
  { key: 'deed_executed', label: 'Executed' },
  { key: 'submitted_to_ksl', label: 'KSL Filed' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral', submitted: 'review', eligibility_check: 'review',
  particulars_review: 'review', deed_generated: 'risk', documents_pending: 'risk',
  ready_for_signature: 'risk', deed_executed: 'done', submitted_to_ksl: 'done',
  approved: 'safe', active: 'safe', completed: 'safe',
  terminated: 'overdue', rejected: 'overdue',
}

const DOC_LABELS: Record<string, string> = {
  signed_deed: 'Signed Pupillage Deed (Form C)',
  pm_current_pc: "Pupil Master's Current PC",
  pm_5yr_pcs: 'PCs Evidencing 5 Years Practice',
  s10_exemption: 'Proof of s.10 Exemption',
  registration_form_d: 'Registration Form (Form D)',
  pupil_id_copy: "Pupil's National ID / Passport",
  pupil_academic_docs: 'LLB Certificate & ATP Admission',
  pupil_kra_bank: 'KRA PIN & Bank Details',
}

export default function PupillageApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [deedHtml, setDeedHtml] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pupillage/applications/${id}`)
      if (res.ok) setApp(await res.json())
      else toast.error('Failed to load application')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    setBusy(actionName)
    try {
      const res = await fetch(`/api/pupillage/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')

      if (actionName === 'generate_deed' && data.deed_html) {
        setDeedHtml(data.deed_html)
      }

      toast.success(
        actionName === 'run_eligibility_check'
          ? data.passed ? 'All checks passed' : 'Some checks failed'
          : actionName === 'generate_deed' ? 'Deed generated'
          : actionName === 'onboard' ? 'Pupil onboarded successfully'
          : 'Updated'
      )
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(null) }
  }

  async function advanceStatus(newStatus: string) {
    await action('advance_status', { new_status: newStatus })
  }

  async function verifyChecklist(itemId: string) {
    setBusy(`verify-${itemId}`)
    try {
      const res = await fetch(`/api/pupillage/applications/${id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status: 'verified' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Document verified')
      load()
    } catch { toast.error('Verification failed') }
    finally { setBusy(null) }
  }

  if (loading) return <div className="p-6"><LoadingState label="Loading application..." /></div>
  if (!app) return <div className="p-6 text-center text-[var(--color-text-muted)]">Application not found</div>

  const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === app.status)
  const pm = app.pupil_master

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/admin/pupillage')} className="btn btn-outline min-h-11 min-w-11 !p-0 flex items-center justify-center flex-shrink-0" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] break-words">{app.pupil_full_name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{app.pupil_email} &middot; Applied {formatDate(app.created_at, 'short')}</p>
        </div>
        <StatusPill tone={STATUS_TONE[app.status] || 'neutral'}>{PIPELINE_STEPS.find(s => s.key === app.status)?.label || app.status}</StatusPill>
      </div>

      {/* Pipeline Progress */}
      <div className="card p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[600px]">
          {PIPELINE_STEPS.map((step, i) => {
            const done = i < currentIdx
            const current = i === currentIdx
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1 ${current ? 'scale-105' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    done ? 'bg-[var(--status-safe)] text-white' :
                    current ? 'bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/30' :
                    'bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]'
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[0.6rem] mt-1 text-center leading-tight ${current ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-0.5 ${done ? 'bg-[var(--status-safe)]' : 'bg-[var(--color-border)]'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pupil Details (Part A) */}
          <Section title="Pupil Particulars (Part A)" icon={<GraduationCap className="w-4 h-4" />}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Full Name" value={app.pupil_full_name} />
              <Field label="ID / Passport" value={app.pupil_id_number} />
              <Field label="DOB" value={app.pupil_dob ? formatDate(app.pupil_dob, 'short') : null} />
              <Field label="Gender" value={app.pupil_gender} />
              <Field label="Phone" value={app.pupil_phone} />
              <Field label="Email" value={app.pupil_email} />
              <Field label="KSL Admission" value={app.pupil_ksl_admission_no} />
              <Field label="ATP Intake" value={app.pupil_atp_intake} />
              <Field label="University" value={app.pupil_university} />
              <Field label="LLB Completed" value={app.pupil_llb_completion_date ? formatDate(app.pupil_llb_completion_date, 'short') : null} />
              <Field label="KRA PIN" value={app.pupil_kra_pin} />
              <Field label="Bank" value={app.pupil_bank_name ? `${app.pupil_bank_name} - ${app.pupil_bank_branch}` : null} />
              <Field label="Next of Kin" value={app.pupil_next_of_kin_name ? `${app.pupil_next_of_kin_name} (${app.pupil_next_of_kin_relationship})` : null} />
              {app.pupil_special_needs && <Field label="Special Needs" value={app.pupil_special_needs_notes} span2 />}
            </dl>
          </Section>

          {/* Term & Facilitation (Part D) */}
          <Section title="Term & Facilitation (Part D)" icon={<Clock className="w-4 h-4" />}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Start Date" value={app.term_start_date ? formatDate(app.term_start_date, 'short') : null} />
              <Field label="End Date" value={app.term_end_date ? formatDate(app.term_end_date, 'short') : null} />
              <Field label="Monthly Stipend" value={app.monthly_stipend ? `KES ${Number(app.monthly_stipend).toLocaleString()}` : null} />
              <Field label="Payment Day" value={app.stipend_payment_day ? `${app.stipend_payment_day}th of each month` : null} />
              <Field label="Other Facilities" value={app.other_facilities} span2 />
            </dl>

            {app.practice_rotations.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">Schedule 1 — Practice Area Rotations</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--color-text-muted)]">
                      <th className="pb-1">#</th><th className="pb-1">Area</th><th className="pb-1">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.practice_rotations.sort((a, b) => a.order - b.order).map(r => (
                      <tr key={r.order}>
                        <td className="py-0.5">{r.order}</td>
                        <td className="py-0.5">{r.area}</td>
                        <td className="py-0.5">{r.duration_months} month(s)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Eligibility Check Results */}
          {app.eligibility_result && (
            <Section title="Eligibility Check" icon={<ShieldCheck className="w-4 h-4" />}>
              <div className="space-y-2">
                {app.eligibility_result.checks.map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-sm">
                    {c.passed ? <CheckCircle2 className="w-4 h-4 text-[var(--status-safe)] flex-shrink-0" /> : <XCircle className="w-4 h-4 text-[var(--status-overdue)] flex-shrink-0" />}
                    <span className="font-medium">{c.name}:</span>
                    <span className="text-[var(--color-text-secondary)]">{c.detail}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Document Checklist */}
          <Section title="Document Checklist (Part E)" icon={<FileText className="w-4 h-4" />}>
            <div className="space-y-2">
              {app.checklist.map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-[var(--color-border)]/50 last:border-0">
                  {item.status === 'verified' ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--status-safe)] flex-shrink-0" />
                  ) : item.status === 'not_applicable' ? (
                    <span className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0 text-center text-xs leading-5">N/A</span>
                  ) : (
                    <Clock className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{DOC_LABELS[item.document_type] || item.document_type}</div>
                    {item.auto_satisfied && <div className="text-xs text-[var(--status-safe)]">Auto-satisfied from existing records</div>}
                    {!item.is_applicable && <div className="text-xs text-[var(--color-text-muted)]">Not applicable</div>}
                  </div>
                  {item.status === 'pending' && item.is_applicable && (
                    <button
                      onClick={() => verifyChecklist(item.id)}
                      disabled={busy === `verify-${item.id}`}
                      className="btn btn-outline text-xs !py-1 !px-2 min-h-9"
                    >
                      {busy === `verify-${item.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Deed Preview */}
          {deedHtml && (
            <Section title="Generated Deed Preview" icon={<FileText className="w-4 h-4" />}>
              <div className="border border-[var(--color-border)] rounded-lg p-4 bg-white text-black overflow-auto max-h-[600px]" dangerouslySetInnerHTML={{ __html: deedHtml }} />
            </Section>
          )}

          {/* Work Book */}
          {app.workbook.length > 0 && (
            <Section title="Work Book Entries" icon={<BookOpen className="w-4 h-4" />}>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {app.workbook.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-[var(--color-border)]/50 last:border-0">
                    {entry.supervisor_signed_off ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-safe)] flex-shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span>{formatDate(entry.entry_date, 'short')}</span>
                        {entry.practice_area && <span className="badge text-xs">{entry.practice_area}</span>}
                        {entry.hours_spent && <span>{entry.hours_spent}h</span>}
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{entry.description}</p>
                    </div>
                    {entry.is_locked && <span className="text-xs text-[var(--color-text-muted)]">Locked</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Pupil Master Info */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Pupil Master (Part B)</h3>
            <div className="text-sm space-y-1.5">
              <div className="font-semibold text-[var(--color-text-primary)]">{pm.team_member.full_name}</div>
              <div className="text-[var(--color-text-muted)]">{pm.team_member.position}</div>
              <div><span className="text-[var(--color-text-muted)]">LSK:</span> {pm.lsk_membership_no}</div>
              <div><span className="text-[var(--color-text-muted)]">Practice:</span> {pm.years_of_practice} yrs</div>
              <div><span className="text-[var(--color-text-muted)]">PC:</span> {pm.current_pc_no || '—'}</div>
              <div>
                <span className="text-[var(--color-text-muted)]">PC Valid To:</span>{' '}
                {pm.pc_valid_to ? (
                  <span className={new Date(pm.pc_valid_to) < new Date() ? 'text-[var(--status-overdue)]' : ''}>
                    {formatDate(pm.pc_valid_to, 'short')}
                  </span>
                ) : '—'}
              </div>
            </div>
          </div>

          {/* Centre Info */}
          {app.centre && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Centre (Part C)</h3>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">{app.centre.firm_name}</div>
              {app.centre.physical_address && <div className="text-xs text-[var(--color-text-muted)]">{app.centre.physical_address}</div>}
            </div>
          )}

          {/* Actions */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Pipeline Actions</h3>

            {app.status === 'draft' && (
              <ActionButton label="Submit Application" icon={<Send className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('submitted')} />
            )}

            {app.status === 'submitted' && (
              <ActionButton label="Run Eligibility Check" icon={<ShieldCheck className="w-4 h-4" />} loading={busy === 'run_eligibility_check'} onClick={() => action('run_eligibility_check')} />
            )}

            {app.status === 'particulars_review' && (
              <ActionButton label="Generate Deed (Form C)" icon={<FileText className="w-4 h-4" />} loading={busy === 'generate_deed'} onClick={() => action('generate_deed')} />
            )}

            {app.status === 'deed_generated' && (
              <ActionButton label="Move to Document Verification" icon={<Upload className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('documents_pending')} />
            )}

            {app.status === 'ready_for_signature' && (
              <ActionButton label="Mark Deed Executed" icon={<CheckCircle2 className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('deed_executed')} />
            )}

            {app.status === 'deed_executed' && (
              <ActionButton label="Mark Submitted to KSL" icon={<Send className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('submitted_to_ksl')} />
            )}

            {app.status === 'submitted_to_ksl' && (
              <ActionButton label="Mark Approved" icon={<CheckCircle2 className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('approved')} />
            )}

            {app.status === 'approved' && !app.onboarded_at && (
              <ActionButton label="Onboard Pupil" icon={<UserCheck className="w-4 h-4" />} loading={busy === 'onboard'} onClick={() => action('onboard')} accent />
            )}

            {app.status === 'active' && (
              <ActionButton label="Mark Completed" icon={<GraduationCap className="w-4 h-4" />} loading={busy === 'advance_status'} onClick={() => advanceStatus('completed')} />
            )}

            {['rejected', 'terminated'].includes(app.status) && (
              <div className="flex items-center gap-2 text-sm text-[var(--status-overdue)]">
                <XCircle className="w-4 h-4" />
                <span>This application is {app.status}.</span>
              </div>
            )}

            {!['rejected', 'terminated', 'completed'].includes(app.status) && (
              <button
                onClick={() => advanceStatus('rejected')}
                className="w-full text-xs text-[var(--status-overdue)] hover:underline mt-2"
              >
                Reject Application
              </button>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Activity</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {app.events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(ev => (
                <div key={ev.id} className="flex gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-[var(--color-text-primary)]">{ev.detail}</div>
                    <div className="text-[var(--color-text-muted)]">
                      {ev.actor?.full_name} &middot; {formatDate(ev.created_at, 'short')}
                    </div>
                  </div>
                </div>
              ))}
              {app.events.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, value, span2 }: { label: string; value: string | null | undefined; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <dt className="text-[var(--color-text-muted)] text-xs">{label}</dt>
      <dd className="text-[var(--color-text-primary)]">{value || '—'}</dd>
    </div>
  )
}

function ActionButton({ label, icon, loading, onClick, accent }: {
  label: string; icon: React.ReactNode; loading: boolean; onClick: () => void; accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 min-h-11 rounded-lg text-sm font-medium transition-colors ${
        accent
          ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]'
          : 'btn btn-primary'
      }`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}
