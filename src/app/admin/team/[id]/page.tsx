'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, User, Scale, Briefcase, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import SectionCard from '@/components/admin/SectionCard'
import { formatDate } from '@/lib/utils'
import {
  daysUntilExpiry, expiryUrgency, EXPIRY_URGENCY_BADGE, EXPIRY_URGENCY_LABEL,
  DOCUMENT_STATUS_META, EMPLOYMENT_STATUS_META, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES,
  SKILL_LEVELS,
} from '@/lib/workforce'

interface Member {
  id: string; full_name: string; email: string; avatar_url?: string; position: string; department: string
  organizational_category_id?: string | null; professional_type_id?: string | null; position_id?: string | null
  employee_number?: string | null; national_id?: string | null; passport_number?: string | null
  kra_pin?: string | null; nssf_number?: string | null; sha_number?: string | null
  date_of_birth?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null
  employment_type?: string | null; employment_status?: string; joining_date?: string | null; exit_date?: string | null
}
interface OrgCategory { id: string; name: string }
interface ProfessionalType { id: string; name: string; org_category_id: string | null }
interface Position { id: string; name: string }
interface PracticeArea { id: string; title: string }
interface Authority { id: string; name: string }
interface MemberAuthority {
  id: string; authority_id: string; issuing_body: string | null; reference_number: string | null
  issue_date: string | null; expiry_date: string | null; status: string; authority: { id: string; name: string }
}
interface Industry { id: string; name: string }
interface Skill { id: string; name: string }
interface MemberSkill { skill_id: string; level: string | null; verified: boolean; years: number | null; last_used: string | null; skill: { id: string; name: string } }
interface DocumentType { id: string; name: string }
interface MemberDocument {
  id: string; document_type_id: string; file_url: string | null; status: string
  issue_date: string | null; expiry_date: string | null; notes: string | null
  document_type: { id: string; name: string }
}

export default function TeamMemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<OrgCategory[]>([])
  const [types, setTypes] = useState<ProfessionalType[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [practiceAreas, setPracticeAreas] = useState<PracticeArea[]>([])
  const [memberPracticeAreaIds, setMemberPracticeAreaIds] = useState<string[]>([])
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [memberAuthorities, setMemberAuthorities] = useState<MemberAuthority[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [memberIndustryIds, setMemberIndustryIds] = useState<string[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [memberSkills, setMemberSkills] = useState<MemberSkill[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [memberDocuments, setMemberDocuments] = useState<MemberDocument[]>([])

  const [showAuthorityForm, setShowAuthorityForm] = useState(false)
  const [authorityForm, setAuthorityForm] = useState({ authority_id: '', issuing_body: '', reference_number: '', issue_date: '', expiry_date: '' })
  const [addingAuthority, setAddingAuthority] = useState(false)
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/team/${params.id}`).then(r => r.json()).catch(() => null),
      fetch('/api/organization/categories').then(r => r.json()).catch(() => []),
      fetch('/api/organization/professional-types').then(r => r.json()).catch(() => []),
      fetch('/api/organization/positions').then(r => r.json()).catch(() => []),
      fetch('/api/practice-areas').then(r => r.json()).catch(() => []),
      fetch(`/api/team/${params.id}/practice-areas`).then(r => r.json()).catch(() => []),
      fetch('/api/organization/authorities').then(r => r.json()).catch(() => []),
      fetch(`/api/team/${params.id}/authorities`).then(r => r.json()).catch(() => []),
      fetch('/api/organization/industries').then(r => r.json()).catch(() => []),
      fetch(`/api/team/${params.id}/industries`).then(r => r.json()).catch(() => []),
      fetch('/api/organization/skills').then(r => r.json()).catch(() => []),
      fetch(`/api/team/${params.id}/skills`).then(r => r.json()).catch(() => []),
      fetch('/api/organization/document-types').then(r => r.json()).catch(() => []),
      fetch(`/api/team/${params.id}/documents`).then(r => r.json()).catch(() => []),
    ]).then(([m, cats, pts, pos, pa, mpa, auth, mauth, ind, mind, sk, msk, dt, mdoc]) => {
      setMember(m)
      setCategories(Array.isArray(cats) ? cats : [])
      setTypes(Array.isArray(pts) ? pts : [])
      setPositions(Array.isArray(pos) ? pos : [])
      setPracticeAreas(Array.isArray(pa) ? pa : [])
      setMemberPracticeAreaIds(Array.isArray(mpa) ? mpa.filter(Boolean).map((p: PracticeArea) => p.id) : [])
      setAuthorities(Array.isArray(auth) ? auth : [])
      setMemberAuthorities(Array.isArray(mauth) ? mauth : [])
      setIndustries(Array.isArray(ind) ? ind : [])
      setMemberIndustryIds(Array.isArray(mind) ? mind.filter(Boolean).map((i: Industry) => i.id) : [])
      setSkills(Array.isArray(sk) ? sk : [])
      setMemberSkills(Array.isArray(msk) ? msk : [])
      setDocumentTypes(Array.isArray(dt) ? dt : [])
      setMemberDocuments(Array.isArray(mdoc) ? mdoc : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [params.id])

  async function saveMember(patch: Partial<Member>) {
    if (!member) return
    setSaving(true)
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      if (res.ok) { toast.success('Saved'); setMember(m => m ? { ...m, ...patch } : m) }
      else toast.error((await res.json().catch(() => ({}))).error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePracticeArea(id: string) {
    const next = memberPracticeAreaIds.includes(id) ? memberPracticeAreaIds.filter(x => x !== id) : [...memberPracticeAreaIds, id]
    setMemberPracticeAreaIds(next)
    await fetch(`/api/team/${params.id}/practice-areas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next }) })
  }

  async function toggleIndustry(id: string) {
    const next = memberIndustryIds.includes(id) ? memberIndustryIds.filter(x => x !== id) : [...memberIndustryIds, id]
    setMemberIndustryIds(next)
    await fetch(`/api/team/${params.id}/industries`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next }) })
  }

  async function toggleSkill(skillId: string) {
    const exists = memberSkills.find(s => s.skill_id === skillId)
    const next = exists ? memberSkills.filter(s => s.skill_id !== skillId) : [...memberSkills, { skill_id: skillId, level: 'intermediate', verified: false, years: null, last_used: null, skill: skills.find(s => s.id === skillId)! }]
    setMemberSkills(next)
    await fetch(`/api/team/${params.id}/skills`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: next.map(s => ({ skill_id: s.skill_id, level: s.level, verified: s.verified, years: s.years, last_used: s.last_used })) }) })
  }

  async function updateSkillLevel(skillId: string, level: string) {
    const next = memberSkills.map(s => s.skill_id === skillId ? { ...s, level } : s)
    setMemberSkills(next)
    await fetch(`/api/team/${params.id}/skills`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: next.map(s => ({ skill_id: s.skill_id, level: s.level, verified: s.verified, years: s.years, last_used: s.last_used })) }) })
  }

  async function addAuthority() {
    if (!authorityForm.authority_id) { toast.error('Select an authority'); return }
    setAddingAuthority(true)
    try {
      const res = await fetch(`/api/team/${params.id}/authorities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authorityForm),
      })
      if (res.ok) { toast.success('Added'); setShowAuthorityForm(false); setAuthorityForm({ authority_id: '', issuing_body: '', reference_number: '', issue_date: '', expiry_date: '' }); load() }
      else toast.error('Could not add')
    } finally {
      setAddingAuthority(false)
    }
  }

  async function removeAuthority(recordId: string) {
    if (!confirm('Remove this authority record?')) return
    const res = await fetch(`/api/team/${params.id}/authorities?record_id=${recordId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); load() }
  }

  async function uploadDocument(documentTypeId: string, file: File) {
    setUploadingDocType(documentTypeId)
    try {
      const formData = new FormData()
      formData.append('document_type_id', documentTypeId)
      formData.append('file', file)
      const res = await fetch(`/api/team/${params.id}/documents`, { method: 'POST', body: formData })
      if (res.ok) { toast.success('Uploaded'); load() }
      else toast.error('Upload failed')
    } finally {
      setUploadingDocType(null)
    }
  }

  async function markDocumentStatus(id: string, status: string) {
    const res = await fetch(`/api/team/${params.id}/documents`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (res.ok) load()
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!member) return <div className="text-center py-20 text-[var(--color-muted)]">Team member not found.</div>

  const filteredTypes = types.filter(t => !member.organizational_category_id || t.org_category_id === member.organizational_category_id)

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Team
      </button>

      <div className="card p-6 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {member.avatar_url
            ? <Image src={member.avatar_url} alt={member.full_name} width={64} height={64} className="object-cover" />
            : <span className="font-display text-2xl text-[var(--color-accent)]">{member.full_name.charAt(0)}</span>}
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">{member.full_name}</h1>
          <p className="text-sm text-[var(--color-muted)]">{member.position} · {member.department}</p>
        </div>
        {member.employment_status && (
          <span className={`badge ${EMPLOYMENT_STATUS_META[member.employment_status]?.badge || 'status-review'} ml-auto`}>
            {EMPLOYMENT_STATUS_META[member.employment_status]?.label || member.employment_status}
          </span>
        )}
      </div>

      <SectionCard title="Personal & Employment" icon={User} color="purple" defaultOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Organizational Category</label>
            <select className="input text-sm" value={member.organizational_category_id || ''} onChange={e => saveMember({ organizational_category_id: e.target.value || null })}>
              <option value="">Not set</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Professional Type</label>
            <select className="input text-sm" value={member.professional_type_id || ''} onChange={e => saveMember({ professional_type_id: e.target.value || null })}>
              <option value="">Not set</option>
              {filteredTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Position (Rank)</label>
            <select className="input text-sm" value={member.position_id || ''} onChange={e => saveMember({ position_id: e.target.value || null })}>
              <option value="">Not set</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employment Status</label>
            <select className="input text-sm" value={member.employment_status || 'active'} onChange={e => saveMember({ employment_status: e.target.value })}>
              {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{EMPLOYMENT_STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employment Type</label>
            <select className="input text-sm" value={member.employment_type || ''} onChange={e => saveMember({ employment_type: e.target.value || null })}>
              <option value="">Not set</option>
              {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employee Number</label>
            <input className="input text-sm" defaultValue={member.employee_number || ''} onBlur={e => e.target.value !== (member.employee_number || '') && saveMember({ employee_number: e.target.value || null })} />
          </div>
          <div>
            <label className="label">National ID</label>
            <input className="input text-sm" defaultValue={member.national_id || ''} onBlur={e => e.target.value !== (member.national_id || '') && saveMember({ national_id: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Passport Number</label>
            <input className="input text-sm" defaultValue={member.passport_number || ''} onBlur={e => e.target.value !== (member.passport_number || '') && saveMember({ passport_number: e.target.value || null })} />
          </div>
          <div>
            <label className="label">KRA PIN</label>
            <input className="input text-sm" defaultValue={member.kra_pin || ''} onBlur={e => e.target.value !== (member.kra_pin || '') && saveMember({ kra_pin: e.target.value || null })} />
          </div>
          <div>
            <label className="label">NSSF Number</label>
            <input className="input text-sm" defaultValue={member.nssf_number || ''} onBlur={e => e.target.value !== (member.nssf_number || '') && saveMember({ nssf_number: e.target.value || null })} />
          </div>
          <div>
            <label className="label">SHA Number</label>
            <input className="input text-sm" defaultValue={member.sha_number || ''} onBlur={e => e.target.value !== (member.sha_number || '') && saveMember({ sha_number: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input type="date" className="input text-sm" defaultValue={member.date_of_birth || ''} onBlur={e => e.target.value !== (member.date_of_birth || '') && saveMember({ date_of_birth: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Joining Date</label>
            <input type="date" className="input text-sm" defaultValue={member.joining_date || ''} onBlur={e => e.target.value !== (member.joining_date || '') && saveMember({ joining_date: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Exit Date</label>
            <input type="date" className="input text-sm" defaultValue={member.exit_date || ''} onBlur={e => e.target.value !== (member.exit_date || '') && saveMember({ exit_date: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Emergency Contact Name</label>
            <input className="input text-sm" defaultValue={member.emergency_contact_name || ''} onBlur={e => e.target.value !== (member.emergency_contact_name || '') && saveMember({ emergency_contact_name: e.target.value || null })} />
          </div>
          <div>
            <label className="label">Emergency Contact Phone</label>
            <input className="input text-sm" defaultValue={member.emergency_contact_phone || ''} onBlur={e => e.target.value !== (member.emergency_contact_phone || '') && saveMember({ emergency_contact_phone: e.target.value || null })} />
          </div>
        </div>
        {saving && <p className="text-xs text-[var(--color-muted)] mt-2">Saving…</p>}
      </SectionCard>

      <SectionCard title="Practice Areas" icon={Scale} color="green">
        <div className="flex flex-wrap gap-2">
          {practiceAreas.map(pa => (
            <button key={pa.id} onClick={() => togglePracticeArea(pa.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${memberPracticeAreaIds.includes(pa.id) ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
              {pa.title}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Legal Authorities" icon={Scale} color="blue"
        headerExtra={<button onClick={() => setShowAuthorityForm(v => !v)} className="btn btn-outline text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>}>
        {showAuthorityForm && (
          <div className="flex flex-col gap-2 mb-4 p-3 rounded-md bg-[var(--color-surface-overlay)]">
            <select className="input text-sm" value={authorityForm.authority_id} onChange={e => setAuthorityForm(f => ({ ...f, authority_id: e.target.value }))}>
              <option value="">Select authority…</option>
              {authorities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Issuing body" value={authorityForm.issuing_body} onChange={e => setAuthorityForm(f => ({ ...f, issuing_body: e.target.value }))} />
              <input className="input text-sm" placeholder="Reference number" value={authorityForm.reference_number} onChange={e => setAuthorityForm(f => ({ ...f, reference_number: e.target.value }))} />
              <input type="date" className="input text-sm" placeholder="Issue date" value={authorityForm.issue_date} onChange={e => setAuthorityForm(f => ({ ...f, issue_date: e.target.value }))} />
              <input type="date" className="input text-sm" placeholder="Expiry date" value={authorityForm.expiry_date} onChange={e => setAuthorityForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <button onClick={addAuthority} disabled={addingAuthority} className="btn btn-primary text-xs self-start">{addingAuthority ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}</button>
          </div>
        )}
        {memberAuthorities.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No legal authorities recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {memberAuthorities.map(a => {
              const urgency = a.expiry_date ? expiryUrgency(daysUntilExpiry(a.expiry_date)) : null
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{a.authority.name}</span>
                    {a.reference_number && <span className="text-xs text-[var(--color-muted)] ml-2">{a.reference_number}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.expiry_date && urgency && (
                      <span className={`badge text-xs ${EXPIRY_URGENCY_BADGE[urgency]}`}>{EXPIRY_URGENCY_LABEL[urgency]} · {formatDate(a.expiry_date, 'short')}</span>
                    )}
                    <button onClick={() => removeAuthority(a.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Industries & Skills" icon={Briefcase} color="gold">
        <div className="mb-4">
          <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Industries</div>
          <div className="flex flex-wrap gap-2">
            {industries.map(i => (
              <button key={i.id} onClick={() => toggleIndustry(i.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${memberIndustryIds.includes(i.id) ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                {i.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-2">Skills</div>
          <div className="flex flex-col gap-1.5">
            {skills.map(s => {
              const assigned = memberSkills.find(ms => ms.skill_id === s.id)
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-[var(--color-surface-overlay)]">
                  <label className="flex items-center gap-2 text-sm flex-1">
                    <input type="checkbox" checked={!!assigned} onChange={() => toggleSkill(s.id)} />
                    {s.name}
                  </label>
                  {assigned && (
                    <select className="input text-xs w-32" value={assigned.level || 'intermediate'} onChange={e => updateSkillLevel(s.id, e.target.value)}>
                      {SKILL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documents" icon={FileText} color="slate"
        defaultOpen={memberDocuments.some(d => d.expiry_date && expiryUrgency(daysUntilExpiry(d.expiry_date)) !== 'ok')}>
        <div className="flex flex-col gap-2">
          {documentTypes.map(dt => {
            const doc = memberDocuments.find(d => d.document_type_id === dt.id)
            const urgency = doc?.expiry_date ? expiryUrgency(daysUntilExpiry(doc.expiry_date)) : null
            return (
              <div key={dt.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                <div className="min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)]">{dt.name}</span>
                  {doc?.expiry_date && <span className="text-xs text-[var(--color-muted)] ml-2">Expires {formatDate(doc.expiry_date, 'short')}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc ? (
                    <>
                      <span className={`badge text-xs ${urgency ? EXPIRY_URGENCY_BADGE[urgency] : DOCUMENT_STATUS_META[doc.status]?.badge}`}>
                        {urgency && urgency !== 'ok' ? EXPIRY_URGENCY_LABEL[urgency] : DOCUMENT_STATUS_META[doc.status]?.label || doc.status}
                      </span>
                      {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-accent)] hover:underline">View</a>}
                      {doc.status !== 'approved' && (
                        <button onClick={() => markDocumentStatus(doc.id, 'approved')} className="btn btn-ghost text-xs !px-1.5">Approve</button>
                      )}
                    </>
                  ) : (
                    <label className="btn btn-outline text-xs gap-1 cursor-pointer">
                      {uploadingDocType === dt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload
                      <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(dt.id, f) }} />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}
