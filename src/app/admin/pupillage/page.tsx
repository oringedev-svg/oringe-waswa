'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Plus, UserCheck, Building2, ArrowRight,
  ShieldCheck, Clock, FileText, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import {
  PageHeader, Modal, DataTable, StatusPill, EmptyState, LoadingState, SearchInput,
  FilterTabs, type Column, type Tone,
} from '@/components/admin/ui'

// ── Types ───────────────────────────────────────────────────
interface PupilMaster {
  id: string
  team_member_id: string
  lsk_membership_no: string
  year_of_admission: number
  years_of_practice: number
  current_pc_no: string | null
  pc_valid_to: string | null
  max_pupils: number
  practice_areas_offered: string[]
  team_member: { id: string; full_name: string; email: string; avatar_url: string | null; position: string }
}

interface Centre {
  id: string
  firm_id: string
  firm_name: string
  postal_address: string | null
  physical_address: string | null
  centre_category: string
  accreditation_ref: string | null
  designated_supervisor_id: string | null
  supervisor_phone: string | null
  supervisor_email: string | null
}

interface Application {
  id: string
  status: string
  pupil_full_name: string
  pupil_email: string
  pupil_phone: string | null
  pupil_ksl_admission_no: string | null
  term_start_date: string | null
  term_end_date: string | null
  created_at: string
  pupil_master: {
    id: string
    team_member: { full_name: string }
  }
}

interface TeamMember {
  id: string
  full_name: string
  email: string
  position: string
  bar_number: string | null
  years_experience: number
}

// ── Constants ───────────────────────────────────────────────
const STATUS_STAGES: { value: string; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'eligibility_check', label: 'Eligibility' },
  { value: 'particulars_review', label: 'Particulars' },
  { value: 'deed_generated', label: 'Deed' },
  { value: 'documents_pending', label: 'Documents' },
  { value: 'ready_for_signature', label: 'Signature' },
  { value: 'deed_executed', label: 'Executed' },
  { value: 'submitted_to_ksl', label: 'KSL' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  submitted: 'review',
  eligibility_check: 'review',
  particulars_review: 'review',
  deed_generated: 'risk',
  documents_pending: 'risk',
  ready_for_signature: 'risk',
  deed_executed: 'done',
  submitted_to_ksl: 'done',
  approved: 'safe',
  active: 'safe',
  completed: 'safe',
  terminated: 'overdue',
  rejected: 'overdue',
}

export default function PupillageDashboardPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'applications' | 'masters' | 'centre'>('applications')

  // Applications state
  const [apps, setApps] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Masters state
  const [masters, setMasters] = useState<PupilMaster[]>([])
  const [loadingMasters, setLoadingMasters] = useState(true)
  const [showMasterModal, setShowMasterModal] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [masterForm, setMasterForm] = useState({
    team_member_id: '',
    lsk_membership_no: '',
    year_of_admission: '',
    years_of_practice: '',
    current_pc_no: '',
    pc_valid_to: '',
    practice_areas_offered: '',
  })
  const [savingMaster, setSavingMaster] = useState(false)

  // Centre state
  const [centre, setCentre] = useState<Centre | null>(null)
  const [loadingCentre, setLoadingCentre] = useState(true)
  const [centreForm, setCentreForm] = useState({
    firm_name: 'Oringe Waswa & Opany Advocates',
    postal_address: '',
    physical_address: '',
    centre_category: 'law_firm',
    accreditation_ref: '',
    supervisor_phone: '',
    supervisor_email: '',
    designated_supervisor_id: '',
  })
  const [savingCentre, setSavingCentre] = useState(false)
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([])

  // ── Loaders ─────────────────────────────────────────────
  const loadApps = useCallback(async () => {
    setLoadingApps(true)
    try {
      const res = await fetch('/api/pupillage/applications')
      if (res.ok) setApps(await res.json())
    } catch { /* ignore */ } finally { setLoadingApps(false) }
  }, [])

  const loadMasters = useCallback(async () => {
    setLoadingMasters(true)
    try {
      const res = await fetch('/api/pupillage/masters')
      if (res.ok) setMasters(await res.json())
    } catch { /* ignore */ } finally { setLoadingMasters(false) }
  }, [])

  const loadCentre = useCallback(async () => {
    setLoadingCentre(true)
    try {
      const res = await fetch('/api/pupillage/centres')
      if (res.ok) {
        const data = await res.json()
        if (data.length > 0) {
          setCentre(data[0])
          setCentreForm({
            firm_name: data[0].firm_name || '',
            postal_address: data[0].postal_address || '',
            physical_address: data[0].physical_address || '',
            centre_category: data[0].centre_category || 'law_firm',
            accreditation_ref: data[0].accreditation_ref || '',
            supervisor_phone: data[0].supervisor_phone || '',
            supervisor_email: data[0].supervisor_email || '',
            designated_supervisor_id: data[0].designated_supervisor_id || '',
          })
        }
      }
    } catch { /* ignore */ } finally { setLoadingCentre(false) }
  }, [])

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setTeamMembers(await res.json())
    } catch { /* ignore */ }
  }, [])

  const loadFirms = useCallback(async () => {
    try {
      const res = await fetch('/api/organization?type=firms')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setFirms(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadApps()
    loadMasters()
    loadCentre()
    loadTeamMembers()
    loadFirms()
  }, [loadApps, loadMasters, loadCentre, loadTeamMembers, loadFirms])

  // ── Master CRUD ─────────────────────────────────────────
  async function saveMaster() {
    if (!masterForm.team_member_id || !masterForm.lsk_membership_no) {
      toast.error('Select a team member and enter LSK membership number')
      return
    }
    setSavingMaster(true)
    try {
      const res = await fetch('/api/pupillage/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...masterForm,
          year_of_admission: parseInt(masterForm.year_of_admission) || new Date().getFullYear(),
          years_of_practice: parseInt(masterForm.years_of_practice) || 0,
          practice_areas_offered: masterForm.practice_areas_offered
            ? masterForm.practice_areas_offered.split(',').map(s => s.trim()).filter(Boolean)
            : [],
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }
      toast.success('Pupil Master registered')
      setShowMasterModal(false)
      setMasterForm({ team_member_id: '', lsk_membership_no: '', year_of_admission: '', years_of_practice: '', current_pc_no: '', pc_valid_to: '', practice_areas_offered: '' })
      loadMasters()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to register')
    } finally { setSavingMaster(false) }
  }

  // ── Centre CRUD ─────────────────────────────────────────
  async function saveCentre() {
    if (!centreForm.firm_name) { toast.error('Firm name is required'); return }
    setSavingCentre(true)
    try {
      const firmId = firms[0]?.id
      if (!firmId) { toast.error('No firm found — create one in Organization settings first'); return }
      const res = await fetch('/api/pupillage/centres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firm_id: firmId, ...centreForm }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCentre(data)
      toast.success('Pupillage centre saved')
    } catch {
      toast.error('Failed to save centre')
    } finally { setSavingCentre(false) }
  }

  // ── Filtered applications ───────────────────────────────
  const filtered = apps.filter(a => {
    if (stageFilter !== 'all' && a.status !== stageFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.pupil_full_name.toLowerCase().includes(q) ||
        a.pupil_email.toLowerCase().includes(q) ||
        a.pupil_master?.team_member?.full_name?.toLowerCase().includes(q)
      )
    }
    return true
  })

  // ── Table columns ───────────────────────────────────────
  const columns: Column<Application>[] = [
    {
      label: 'Pupil',
      render: (a) => (
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">{a.pupil_full_name}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{a.pupil_email}</div>
        </div>
      ),
    },
    {
      label: 'Pupil Master',
      render: (a) => a.pupil_master?.team_member?.full_name || '—',
      secondary: true,
    },
    {
      label: 'Status',
      render: (a) => (
        <StatusPill tone={STATUS_TONE[a.status] || 'neutral'}>
          {STATUS_STAGES.find(s => s.value === a.status)?.label || a.status}
        </StatusPill>
      ),
    },
    {
      label: 'Term',
      render: (a) =>
        a.term_start_date
          ? `${formatDate(a.term_start_date, 'short')} → ${a.term_end_date ? formatDate(a.term_end_date, 'short') : '?'}`
          : '—',
      secondary: true,
    },
    {
      label: 'Applied',
      render: (a) => formatDate(a.created_at, 'short'),
      secondary: true,
    },
  ]

  // ── Count badges ────────────────────────────────────────
  const activeCount = apps.filter(a => a.status === 'active').length
  const pendingCount = apps.filter(a => ['submitted', 'eligibility_check', 'particulars_review', 'deed_generated', 'documents_pending', 'ready_for_signature'].includes(a.status)).length

  // ── Existing masters (to exclude from dropdown) ────────
  const existingMasterTmIds = new Set(masters.map(m => m.team_member_id))
  const eligibleForMaster = teamMembers.filter(tm =>
    !existingMasterTmIds.has(tm.id) && (tm.years_experience >= 5 || tm.bar_number)
  )

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Pupillage Programme"
        description="End-to-end pupillage intake, deeds, and work book tracking"
        icon={GraduationCap}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={<GraduationCap className="w-4 h-4" />} label="Active Pupils" value={activeCount} />
        <StatBox icon={<Clock className="w-4 h-4" />} label="In Pipeline" value={pendingCount} />
        <StatBox icon={<UserCheck className="w-4 h-4" />} label="Pupil Masters" value={masters.length} />
        <StatBox icon={<Building2 className="w-4 h-4" />} label="Centre" value={centre ? 'Configured' : 'Not set'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(['applications', 'masters', 'centre'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 min-h-11 ${
              tab === t
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {t === 'centre' ? 'Centre Setup' : t === 'masters' ? 'Pupil Masters' : 'Applications'}
          </button>
        ))}
      </div>

      {/* ───────── Applications Tab ───────── */}
      {tab === 'applications' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <SearchInput value={search} onChange={setSearch} placeholder="Search pupils or masters..." />
            <button
              onClick={() => router.push('/admin/pupillage/new')}
              className="btn btn-primary flex items-center gap-2 min-h-11"
            >
              <Plus className="w-4 h-4" /> New Application
            </button>
          </div>

          <FilterTabs
            value={stageFilter}
            onChange={setStageFilter}
            options={[
              { value: 'all', label: 'All', count: apps.length },
              ...STATUS_STAGES.map(s => ({ value: s.value, label: s.label, count: apps.filter(a => a.status === s.value).length })),
            ]}
          />

          {loadingApps ? (
            <LoadingState label="Loading applications..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No applications"
              description={stageFilter !== 'all' ? 'No applications at this stage.' : 'Start by registering Pupil Masters and creating the first application.'}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(a) => a.id}
              onRowClick={(row) => router.push(`/admin/pupillage/${row.id}`)}
            />
          )}
        </div>
      )}

      {/* ───────── Pupil Masters Tab ───────── */}
      {tab === 'masters' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Register advocates as eligible Pupil Masters. They must have 5+ years of practice and a current PC.
            </p>
            <button onClick={() => setShowMasterModal(true)} className="btn btn-primary flex items-center gap-2 min-h-11">
              <Plus className="w-4 h-4" /> Register Master
            </button>
          </div>

          {loadingMasters ? (
            <LoadingState label="Loading masters..." />
          ) : masters.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No Pupil Masters registered"
              description="Register at least one advocate as a Pupil Master before creating applications."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {masters.map(m => {
                const pcExpired = m.pc_valid_to ? new Date(m.pc_valid_to) < new Date() : true
                return (
                  <div key={m.id} className="card p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)]">{m.team_member.full_name}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">{m.team_member.position} &middot; {m.team_member.email}</p>
                      </div>
                      {pcExpired ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--status-overdue)]">
                          <AlertTriangle className="w-3.5 h-3.5" /> PC Expired
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-[var(--status-safe)]">
                          <ShieldCheck className="w-3.5 h-3.5" /> Eligible
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">LSK No:</span> {m.lsk_membership_no}</div>
                      <div><span className="text-[var(--color-text-muted)]">Admitted:</span> {m.year_of_admission}</div>
                      <div><span className="text-[var(--color-text-muted)]">Practice:</span> {m.years_of_practice} yrs</div>
                      <div><span className="text-[var(--color-text-muted)]">PC:</span> {m.current_pc_no || '—'} (to {m.pc_valid_to ? formatDate(m.pc_valid_to, 'short') : '—'})</div>
                      <div className="col-span-2"><span className="text-[var(--color-text-muted)]">Max pupils:</span> {m.max_pupils}</div>
                    </div>
                    {m.practice_areas_offered.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.practice_areas_offered.map(a => (
                          <span key={a} className="badge text-xs">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────── Centre Setup Tab ───────── */}
      {tab === 'centre' && (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Configure the firm's pupillage centre details. These auto-populate every Deed and KSL submission.
          </p>

          {loadingCentre ? (
            <LoadingState label="Loading centre..." />
          ) : (
            <div className="card p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Firm / Centre Name</label>
                  <input className="input text-base sm:text-sm" value={centreForm.firm_name} onChange={e => setCentreForm(f => ({ ...f, firm_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Centre Category</label>
                  <select className="input text-base sm:text-sm" value={centreForm.centre_category} onChange={e => setCentreForm(f => ({ ...f, centre_category: e.target.value }))}>
                    <option value="law_firm">Law Firm</option>
                    <option value="government">Government</option>
                    <option value="ngo">NGO</option>
                    <option value="corporate">Corporate</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Physical Address</label>
                  <input className="input text-base sm:text-sm" value={centreForm.physical_address} onChange={e => setCentreForm(f => ({ ...f, physical_address: e.target.value }))} placeholder="e.g. 2nd Floor, Hazina Towers, Monrovia St, Nairobi" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Postal Address</label>
                  <input className="input text-base sm:text-sm" value={centreForm.postal_address} onChange={e => setCentreForm(f => ({ ...f, postal_address: e.target.value }))} placeholder="e.g. P.O. Box 12345-00100, Nairobi" />
                </div>
                <div>
                  <label className="label">KSL Accreditation Ref</label>
                  <input className="input text-base sm:text-sm" value={centreForm.accreditation_ref} onChange={e => setCentreForm(f => ({ ...f, accreditation_ref: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Designated Supervisor</label>
                  <select className="input text-base sm:text-sm" value={centreForm.designated_supervisor_id} onChange={e => setCentreForm(f => ({ ...f, designated_supervisor_id: e.target.value }))}>
                    <option value="">Select supervisor</option>
                    {teamMembers.filter(t => t.bar_number || t.years_experience >= 5).map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Supervisor Phone</label>
                  <input className="input text-base sm:text-sm" value={centreForm.supervisor_phone} onChange={e => setCentreForm(f => ({ ...f, supervisor_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Supervisor Email</label>
                  <input className="input text-base sm:text-sm" value={centreForm.supervisor_email} onChange={e => setCentreForm(f => ({ ...f, supervisor_email: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={saveCentre} disabled={savingCentre} className="btn btn-primary min-h-11">
                  {savingCentre ? 'Saving...' : centre ? 'Update Centre' : 'Save Centre'}
                </button>
              </div>

              {centre && (
                <div className="flex items-center gap-2 text-xs text-[var(--status-safe)]">
                  <CheckCircle2 className="w-4 h-4" />
                  Centre is configured. These details will auto-populate all deeds.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───────── Register Master Modal ───────── */}
      <Modal
        open={showMasterModal}
        onClose={() => setShowMasterModal(false)}
        title="Register Pupil Master"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Advocate (Team Member)</label>
            <select className="input text-base sm:text-sm" value={masterForm.team_member_id} onChange={e => setMasterForm(f => ({ ...f, team_member_id: e.target.value }))}>
              <option value="">Select an advocate...</option>
              {eligibleForMaster.map(t => (
                <option key={t.id} value={t.id}>{t.full_name} — {t.position} ({t.years_experience} yrs)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">LSK Membership No.</label>
              <input className="input text-base sm:text-sm" value={masterForm.lsk_membership_no} onChange={e => setMasterForm(f => ({ ...f, lsk_membership_no: e.target.value }))} placeholder="e.g. LSK/2015/12345" />
            </div>
            <div>
              <label className="label">Year of Admission</label>
              <input type="number" className="input text-base sm:text-sm" value={masterForm.year_of_admission} onChange={e => setMasterForm(f => ({ ...f, year_of_admission: e.target.value }))} placeholder="e.g. 2015" />
            </div>
            <div>
              <label className="label">Years of Practice</label>
              <input type="number" className="input text-base sm:text-sm" value={masterForm.years_of_practice} onChange={e => setMasterForm(f => ({ ...f, years_of_practice: e.target.value }))} placeholder="Min 5" />
            </div>
            <div>
              <label className="label">Current PC No.</label>
              <input className="input text-base sm:text-sm" value={masterForm.current_pc_no} onChange={e => setMasterForm(f => ({ ...f, current_pc_no: e.target.value }))} />
            </div>
            <div>
              <label className="label">PC Valid To</label>
              <input type="date" className="input text-base sm:text-sm" value={masterForm.pc_valid_to} onChange={e => setMasterForm(f => ({ ...f, pc_valid_to: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Practice Areas Offered (comma-separated)</label>
            <input className="input text-base sm:text-sm" value={masterForm.practice_areas_offered} onChange={e => setMasterForm(f => ({ ...f, practice_areas_offered: e.target.value }))} placeholder="Civil Litigation, Corporate Law, Family Law" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowMasterModal(false)} className="btn btn-outline min-h-11">Cancel</button>
            <button onClick={saveMaster} disabled={savingMaster} className="btn btn-primary min-h-11">
              {savingMaster ? 'Registering...' : 'Register'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-overlay)] flex items-center justify-center text-[var(--color-accent)]">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold text-[var(--color-text-primary)]">{value}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      </div>
    </div>
  )
}
