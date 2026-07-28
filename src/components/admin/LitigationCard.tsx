'use client'
import { useEffect, useState } from 'react'
import { Gavel, Loader2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { LITIGATION_STATUSES, litigationStatusMeta, courtTypeLabel, registryTypeLabel } from '@/lib/litigationStatus'

interface Court {
  id: string
  name: string
  court_type: string
  station?: string
  county?: string
  registry_type?: string
}

interface Props {
  matterId: string
  litigationStatus?: string
  courtId?: string | null
  /** Legacy free-text court, shown only so an old value is not silently lost. */
  legacyCourt?: string
  caseNumber?: string
  filedAt?: string | null
  canEdit: boolean
  onSaved?: () => void
}

// Where the dispute has reached, and (once it is before a court) which court
// it is before. The court is chosen from the register rather than typed, so
// the same court cannot be recorded three different ways across three files.
export default function LitigationCard({
  matterId, litigationStatus = 'pre_action', courtId, legacyCourt, caseNumber, filedAt, canEdit, onSaved,
}: Props) {
  const [courts, setCourts] = useState<Court[]>([])
  const [status, setStatus] = useState(litigationStatus)
  const [court, setCourt] = useState(courtId ?? '')
  const [caseNo, setCaseNo] = useState(caseNumber ?? '')
  const [filed, setFiled] = useState(filedAt ?? '')
  const [saving, setSaving] = useState(false)
  const [registerMissing, setRegisterMissing] = useState(false)

  useEffect(() => {
    fetch('/api/courts?active=true')
      .then(async r => { if (!r.ok) { setRegisterMissing(true); return [] } return r.json() })
      .then(d => setCourts(Array.isArray(d) ? d : []))
      .catch(() => setRegisterMissing(true))
  }, [])

  const meta = litigationStatusMeta(status)
  const needsCourt = meta.requiresCourt
  const missingCourt = needsCourt && !court

  // Group the register by court type so the picker reads as a hierarchy
  // rather than one flat list of a hundred stations.
  const grouped = courts.reduce<Record<string, Court[]>>((acc, c) => {
    (acc[c.court_type] ||= []).push(c)
    return acc
  }, {})

  async function save() {
    if (missingCourt) {
      toast.error(`"${meta.label}" means the matter is before a court. Select which court.`)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/files/matters/${matterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          litigation_status: status,
          court_id: court || null,
          case_number: caseNo || null,
          filed_at: filed || null,
        }),
      })
      if (res.ok) { toast.success('Litigation details saved'); onSaved?.() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally { setSaving(false) }
  }

  const dirty =
    status !== litigationStatus ||
    court !== (courtId ?? '') ||
    caseNo !== (caseNumber ?? '') ||
    filed !== (filedAt ?? '')

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Gavel className="w-4 h-4 text-[var(--color-brand)]" />
        <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Litigation</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">
        Where the dispute has reached. Separate from the matter stage, which tracks the engagement.
      </p>

      {registerMissing ? (
        <div className="text-sm text-[var(--color-text-muted)]">
          The courts register is not set up yet. Run migration <code>025_courts_and_litigation.sql</code> to enable
          court selection and litigation tracking.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Status</label>
            <select className="input text-sm" value={status} disabled={!canEdit} onChange={e => setStatus(e.target.value)}>
              {LITIGATION_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <p className="text-xs text-[var(--color-muted)] mt-1.5">{meta.description}</p>
          </div>

          {needsCourt && (
            <>
              <div>
                <label className="label">Court {missingCourt && <span className="text-red-500">*</span>}</label>
                <select className="input text-sm" value={court} disabled={!canEdit} onChange={e => setCourt(e.target.value)}>
                  <option value="">Select court…</option>
                  {Object.entries(grouped).map(([type, list]) => (
                    <optgroup key={type} label={courtTypeLabel(type)}>
                      {list.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.station ? `, ${c.station}` : ''}
                          {c.registry_type && c.registry_type !== 'unspecified' ? ` (${registryTypeLabel(c.registry_type)})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {missingCourt && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    A matter at this status must have a court on record.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Case Number</label>
                  <input className="input text-sm" value={caseNo} disabled={!canEdit} onChange={e => setCaseNo(e.target.value)} placeholder="HCCC 123 of 2026" />
                </div>
                <div>
                  <label className="label">Date Filed</label>
                  <input type="date" className="input text-sm" value={filed ? filed.slice(0, 10) : ''} disabled={!canEdit} onChange={e => setFiled(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {legacyCourt && !court && (
            <p className="text-xs text-[var(--color-muted)]">
              Previously recorded as free text: <span className="text-[var(--color-text-secondary)]">{legacyCourt}</span>. Pick the
              matching court above to bring it onto the register.
            </p>
          )}

          {canEdit && (
            <button onClick={save} disabled={saving || !dirty} className="btn btn-primary gap-2 text-sm self-start">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save litigation details
            </button>
          )}
        </div>
      )}
    </div>
  )
}
