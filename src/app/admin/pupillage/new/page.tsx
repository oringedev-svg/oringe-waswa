'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/admin/ui'

interface PupilMaster {
  id: string
  lsk_membership_no: string
  years_of_practice: number
  practice_areas_offered: string[]
  team_member: { full_name: string }
}

interface Centre {
  id: string
  firm_name: string
}

const PRACTICE_AREAS = [
  'Civil Litigation', 'Criminal Defense', 'Family Law', 'Corporate Law',
  'Property Law', 'Immigration', 'Employment Law', 'Intellectual Property',
  'Constitutional Law', 'Alternative Dispute Resolution', 'Tax Law',
  'Banking & Finance', 'Insurance Law', 'Environmental Law',
]

export default function NewPupillageApplicationPage() {
  const router = useRouter()
  const [masters, setMasters] = useState<PupilMaster[]>([])
  const [centres, setCentres] = useState<Centre[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    pupil_master_id: '',
    pupil_full_name: '',
    pupil_id_number: '',
    pupil_dob: '',
    pupil_gender: '',
    pupil_phone: '',
    pupil_email: '',
    pupil_postal_address: '',
    pupil_ksl_admission_no: '',
    pupil_atp_intake: '',
    pupil_university: '',
    pupil_llb_completion_date: '',
    pupil_kra_pin: '',
    pupil_bank_name: '',
    pupil_bank_branch: '',
    pupil_bank_account: '',
    pupil_mobile_money_no: '',
    pupil_next_of_kin_name: '',
    pupil_next_of_kin_phone: '',
    pupil_next_of_kin_relationship: '',
    pupil_special_needs: false,
    pupil_special_needs_notes: '',
    term_start_date: '',
    term_end_date: '',
    monthly_stipend: '',
    stipend_payment_day: '25',
    other_facilities: '',
  })

  const [rotations, setRotations] = useState<{ area: string; duration_months: number }[]>([])

  const loadData = useCallback(async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/pupillage/masters'),
        fetch('/api/pupillage/centres'),
      ])
      if (mRes.ok) setMasters(await mRes.json())
      if (cRes.ok) {
        const c = await cRes.json()
        setCentres(c)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function setField(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function addRotation() {
    setRotations(r => [...r, { area: '', duration_months: 3 }])
  }

  function removeRotation(idx: number) {
    setRotations(r => r.filter((_, i) => i !== idx))
  }

  function updateRotation(idx: number, key: string, value: string | number) {
    setRotations(r => r.map((rot, i) => i === idx ? { ...rot, [key]: value } : rot))
  }

  async function submit() {
    if (!form.pupil_master_id) { toast.error('Select a Pupil Master'); return }
    if (!form.pupil_full_name) { toast.error('Pupil name is required'); return }
    if (!form.pupil_email) { toast.error('Email is required'); return }

    setSaving(true)
    try {
      const body = {
        ...form,
        monthly_stipend: form.monthly_stipend ? parseFloat(form.monthly_stipend) : null,
        stipend_payment_day: form.stipend_payment_day ? parseInt(form.stipend_payment_day) : null,
        pupil_special_needs: form.pupil_special_needs,
        practice_rotations: rotations.map((r, i) => ({ ...r, order: i + 1 })),
        centre_id: centres[0]?.id || null,
      }

      const res = await fetch('/api/pupillage/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }

      const app = await res.json()
      toast.success('Application created')
      router.push(`/admin/pupillage/${app.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create')
    } finally { setSaving(false) }
  }

  const selectedMaster = masters.find(m => m.id === form.pupil_master_id)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/pupillage')} className="btn btn-outline min-h-11 min-w-11 !p-0 flex items-center justify-center" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <PageHeader title="New Pupillage Application" description="Part A: Pupil details + Part D: Term" />
      </div>

      {/* Pupil Master Selection */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Pupil Master Assignment</h2>
        <select className="input text-base sm:text-sm" value={form.pupil_master_id} onChange={e => setField('pupil_master_id', e.target.value)}>
          <option value="">Select Pupil Master...</option>
          {masters.map(m => (
            <option key={m.id} value={m.id}>
              {m.team_member.full_name} — LSK {m.lsk_membership_no} ({m.years_of_practice} yrs)
            </option>
          ))}
        </select>
        {masters.length === 0 && (
          <p className="text-xs text-[var(--status-overdue)]">No Pupil Masters registered. Go to the Masters tab first.</p>
        )}
      </div>

      {/* Part A: Pupil Particulars */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Part A — Pupil Particulars</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <InputField label="Full Name *" value={form.pupil_full_name} onChange={v => setField('pupil_full_name', v)} />
          <InputField label="ID / Passport No." value={form.pupil_id_number} onChange={v => setField('pupil_id_number', v)} />
          <InputField label="Date of Birth" type="date" value={form.pupil_dob} onChange={v => setField('pupil_dob', v)} />
          <div>
            <label className="label">Gender</label>
            <select className="input text-base sm:text-sm" value={form.pupil_gender} onChange={e => setField('pupil_gender', e.target.value)}>
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <InputField label="Phone *" value={form.pupil_phone} onChange={v => setField('pupil_phone', v)} placeholder="+254..." />
          <InputField label="Email *" type="email" value={form.pupil_email} onChange={v => setField('pupil_email', v)} />
          <div className="sm:col-span-2">
            <InputField label="Postal Address" value={form.pupil_postal_address} onChange={v => setField('pupil_postal_address', v)} />
          </div>
        </div>

        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase pt-2">Academic & Professional</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <InputField label="KSL Admission No." value={form.pupil_ksl_admission_no} onChange={v => setField('pupil_ksl_admission_no', v)} />
          <InputField label="ATP Intake / Cohort" value={form.pupil_atp_intake} onChange={v => setField('pupil_atp_intake', v)} placeholder="e.g. Jan 2026" />
          <InputField label="University" value={form.pupil_university} onChange={v => setField('pupil_university', v)} />
          <InputField label="LLB Completion Date" type="date" value={form.pupil_llb_completion_date} onChange={v => setField('pupil_llb_completion_date', v)} />
        </div>

        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase pt-2">Financial</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <InputField label="KRA PIN" value={form.pupil_kra_pin} onChange={v => setField('pupil_kra_pin', v)} />
          <InputField label="Bank Name" value={form.pupil_bank_name} onChange={v => setField('pupil_bank_name', v)} />
          <InputField label="Bank Branch" value={form.pupil_bank_branch} onChange={v => setField('pupil_bank_branch', v)} />
          <InputField label="Account No." value={form.pupil_bank_account} onChange={v => setField('pupil_bank_account', v)} />
          <InputField label="Mobile Money No." value={form.pupil_mobile_money_no} onChange={v => setField('pupil_mobile_money_no', v)} />
        </div>

        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase pt-2">Next of Kin</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <InputField label="Name" value={form.pupil_next_of_kin_name} onChange={v => setField('pupil_next_of_kin_name', v)} />
          <InputField label="Phone" value={form.pupil_next_of_kin_phone} onChange={v => setField('pupil_next_of_kin_phone', v)} />
          <InputField label="Relationship" value={form.pupil_next_of_kin_relationship} onChange={v => setField('pupil_next_of_kin_relationship', v)} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input type="checkbox" id="special_needs" checked={form.pupil_special_needs} onChange={e => setField('pupil_special_needs', e.target.checked)} className="rounded" />
          <label htmlFor="special_needs" className="text-sm text-[var(--color-text-secondary)]">Special needs / accommodations required</label>
        </div>
        {form.pupil_special_needs && (
          <InputField label="Special Needs Details" value={form.pupil_special_needs_notes} onChange={v => setField('pupil_special_needs_notes', v)} />
        )}
      </div>

      {/* Part D: Term & Facilitation */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Part D — Term & Facilitation</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <InputField label="Start Date" type="date" value={form.term_start_date} onChange={v => setField('term_start_date', v)} />
          <InputField label="End Date" type="date" value={form.term_end_date} onChange={v => setField('term_end_date', v)} />
          <InputField label="Monthly Stipend (KES)" type="number" value={form.monthly_stipend} onChange={v => setField('monthly_stipend', v)} />
          <InputField label="Payment Day (1-31)" type="number" value={form.stipend_payment_day} onChange={v => setField('stipend_payment_day', v)} />
          <div className="sm:col-span-2">
            <InputField label="Other Facilities" value={form.other_facilities} onChange={v => setField('other_facilities', v)} placeholder="e.g. Laptop, transport allowance" />
          </div>
        </div>
      </div>

      {/* Schedule 1: Rotations */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Schedule 1 — Practice Area Rotations</h2>
          <button onClick={addRotation} className="btn btn-outline text-xs min-h-9 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {selectedMaster && selectedMaster.practice_areas_offered.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {selectedMaster.team_member.full_name} offers: {selectedMaster.practice_areas_offered.join(', ')}
          </p>
        )}

        {rotations.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No rotations added. Click "Add" to define practice area rotations.</p>
        ) : (
          <div className="space-y-3">
            {rotations.map((r, i) => (
              <div key={i} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label">Practice Area</label>
                  <select className="input text-base sm:text-sm" value={r.area} onChange={e => updateRotation(i, 'area', e.target.value)}>
                    <option value="">Select...</option>
                    {PRACTICE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="label">Months</label>
                  <input type="number" min={1} max={12} className="input text-base sm:text-sm" value={r.duration_months} onChange={e => updateRotation(i, 'duration_months', parseInt(e.target.value) || 1)} />
                </div>
                <button onClick={() => removeRotation(i)} className="btn btn-outline min-h-11 min-w-11 !p-0 flex items-center justify-center text-[var(--status-overdue)]" aria-label="Remove">
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button onClick={() => router.push('/admin/pupillage')} className="btn btn-outline min-h-11">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn btn-primary min-h-11">
          {saving ? 'Creating...' : 'Create Application'}
        </button>
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input text-base sm:text-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
