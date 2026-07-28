'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, ChevronDown, Calculator, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface FeeRuleBand {
  id: string
  from_value: number
  to_value: number | null
  rate: number | null
  flat_amount: number | null
  sequence: number
}
interface FeeRuleCondition {
  id: string
  field: string
  operator: string
  value: string
}
interface FeeRuleExplanation {
  id: string
  plain_language: string
  legal_reference: string | null
}
interface FeeRule {
  id: string
  paragraph: string | null
  name: string
  calculation_type: string
  minimum: number | null
  maximum: number | null
  fixed_amount: number | null
  unit_rate: number | null
  currency: string
  bands: FeeRuleBand[]
  conditions: FeeRuleCondition[]
  explanations: FeeRuleExplanation[]
}
interface FeeSchedule {
  id: string
  number: string
  title: string
  rules: FeeRule[]
}
interface LegalInstrument {
  id: string
  slug: string
  name: string
  authority: string | null
  version: string
  effective_date: string | null
  status: 'draft' | 'active' | 'archived' | 'invalid'
  source_note: string | null
  pdf_url: string | null
  schedules: FeeSchedule[]
}

const EXAMPLE_JSON = {
  instrument: { slug: 'court-fees', name: 'Court Fees Schedule', authority: 'Judiciary', instrument_type: 'Court Fees Schedule', version: '2025', effective_date: '2025-01-01', source_note: 'Example only' },
  schedules: [{ id: 's1', number: '1', title: 'Filing Fees' }],
  rules: [{ id: 'r1', schedule: 's1', paragraph: '1', name: 'Plaint Filing Fee', calculation_type: 'FIXED', fixed_amount: 5000, currency: 'KES' }],
  bands: [],
  conditions: [{ rule: 'r1', field: 'matterType', operator: '=', value: 'civil_litigation' }],
  explanations: [{ rule: 'r1', plain_language: 'Standard fee for filing a plaint.', legal_reference: 'Court Fees Schedule, Item 1' }],
}

const STATUS_BADGE: Record<string, string> = { active: 'status-active', draft: 'status-pending', archived: 'status-review', invalid: 'status-rejected' }

export default function AdminFeeSchedulesPage() {
  const [instruments, setInstruments] = useState<LegalInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showImport, setShowImport] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [editingRule, setEditingRule] = useState<{ id: string; minimum: string; maximum: string; fixed_amount: string; unit_rate: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/legal-instruments')
      .then(r => r.json())
      .then(d => setInstruments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function submitImport() {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setImportErrors(['Not valid JSON, check for a trailing comma or missing bracket'])
      return
    }
    setImporting(true)
    setImportErrors([])
    try {
      const res = await fetch('/api/legal-instruments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (res.ok) {
        toast.success('Instrument imported and activated')
        setShowImport(false)
        setJsonText('')
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        setImportErrors(err.errors || [err.error || 'Import failed'])
      }
    } finally {
      setImporting(false)
    }
  }

  async function deleteInstrument(id: string, status: string) {
    if (status === 'active') { toast.error('Import a new version to replace an active instrument, it cannot be deleted directly'); return }
    if (!confirm('Delete this instrument and all its schedules/rules?')) return
    const res = await fetch(`/api/legal-instruments/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); load() }
    else toast.error((await res.json().catch(() => ({}))).error || 'Delete failed')
  }

  async function saveRuleEdit() {
    if (!editingRule) return
    setSaving(true)
    try {
      const payload: Record<string, number | null> = {}
      for (const [key, val] of Object.entries({ minimum: editingRule.minimum, maximum: editingRule.maximum, fixed_amount: editingRule.fixed_amount, unit_rate: editingRule.unit_rate })) {
        payload[key] = val === '' ? null : Number(val)
      }
      const res = await fetch(`/api/fee-rules/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { toast.success('Rule updated'); setEditingRule(null); load() }
      else toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Fee Schedules</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Legal instruments, fee rules, and the cost estimation they drive on matters. Never hardcoded, imported as structured content.</p>
        </div>
        <button onClick={() => { setShowImport(true); setJsonText(JSON.stringify(EXAMPLE_JSON, null, 2)); setImportErrors([]) }} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Import Instrument
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : instruments.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No legal instruments imported yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {instruments.map(inst => {
            const isOpen = expanded[inst.id] ?? false
            const ruleCount = inst.schedules.reduce((n, s) => n + s.rules.length, 0)
            return (
              <div key={inst.id} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-4">
                  <button onClick={() => setExpanded(e => ({ ...e, [inst.id]: !isOpen }))} className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    <Calculator className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{inst.name}</span>
                        <span className="text-xs text-[var(--color-muted)]">v{inst.version}</span>
                        <span className={`badge text-xs ${STATUS_BADGE[inst.status]}`}>{inst.status}</span>
                        <span className="text-xs text-[var(--color-muted)]">{inst.schedules.length} schedule{inst.schedules.length === 1 ? '' : 's'}, {ruleCount} rule{ruleCount === 1 ? '' : 's'}</span>
                      </div>
                      {inst.source_note && <p className="text-xs text-amber-600 line-clamp-1 mt-0.5">{inst.source_note}</p>}
                    </div>
                  </button>
                  <div className="flex gap-1 flex-shrink-0">
                    {inst.pdf_url && (
                      <a href={inst.pdf_url} target="_blank" rel="noreferrer" className="btn btn-ghost p-1.5 !px-1.5"><FileText className="w-3.5 h-3.5" /></a>
                    )}
                    {inst.status !== 'active' && (
                      <button onClick={() => deleteInstrument(inst.id, inst.status)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3">
                    {inst.schedules.map(sched => (
                      <div key={sched.id} className="rounded-md bg-[var(--color-surface-overlay)] p-3">
                        <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-2">Schedule {sched.number}: {sched.title}</div>
                        <div className="flex flex-col gap-2">
                          {sched.rules.map(rule => (
                            <div key={rule.id} className="p-2.5 rounded bg-[var(--color-surface)] text-xs">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {rule.paragraph && <span className="text-[var(--color-muted)]">¶{rule.paragraph}</span>}
                                  <span className="font-medium text-[var(--color-text-primary)]">{rule.name}</span>
                                  <span className="badge status-review text-xs">{rule.calculation_type}</span>
                                </div>
                                <button onClick={() => setEditingRule({ id: rule.id, minimum: rule.minimum?.toString() ?? '', maximum: rule.maximum?.toString() ?? '', fixed_amount: rule.fixed_amount?.toString() ?? '', unit_rate: rule.unit_rate?.toString() ?? '' })} className="btn btn-ghost p-1 !px-1"><Edit className="w-3 h-3" /></button>
                              </div>
                              <div className="text-[var(--color-muted)] mt-1">
                                {rule.minimum != null && <span>Min {rule.currency} {rule.minimum.toLocaleString()} </span>}
                                {rule.maximum != null && <span>Max {rule.currency} {rule.maximum.toLocaleString()} </span>}
                                {rule.fixed_amount != null && <span>Fixed {rule.currency} {rule.fixed_amount.toLocaleString()} </span>}
                                {rule.unit_rate != null && <span>Rate {rule.currency} {rule.unit_rate.toLocaleString()}/unit </span>}
                              </div>
                              {rule.bands.length > 0 && (
                                <div className="mt-1.5 flex flex-col gap-0.5">
                                  {rule.bands.slice().sort((a, b) => a.sequence - b.sequence).map(b => (
                                    <div key={b.id} className="text-[var(--color-muted)]">
                                      {b.from_value.toLocaleString()}–{b.to_value?.toLocaleString() ?? '∞'}: {b.flat_amount != null && `flat ${b.flat_amount.toLocaleString()}`}{b.flat_amount != null && b.rate ? ' + ' : ''}{b.rate ? `${(b.rate * 100).toFixed(2)}%` : ''}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {rule.conditions.length > 0 && (
                                <div className="mt-1.5 text-[var(--color-muted)]">
                                  Applies when {rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(' and ')}
                                </div>
                              )}
                              {rule.explanations[0] && (
                                <p className="mt-1.5 text-[var(--color-text-secondary)]">{rule.explanations[0].plain_language}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Import Legal Instrument</h2>
              <button onClick={() => setShowImport(false)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              Paste the instrument JSON (instrument, schedules, rules, bands, conditions, explanations). It&apos;s validated before anything is saved, invalid JSON is rejected without touching existing data. A working example is pre-filled below.
            </p>
            <textarea
              rows={16}
              className="input text-xs font-mono"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              spellCheck={false}
            />
            {importErrors.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400">
                <p className="font-semibold mb-1">Validation failed:</p>
                <ul className="list-disc list-inside flex flex-col gap-0.5">
                  {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={submitImport} disabled={importing} className="btn btn-primary flex-1 gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Validate &amp; Import
              </button>
              <button onClick={() => setShowImport(false)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Rule quick-edit modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingRule(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Quick Edit</h2>
              <button onClick={() => setEditingRule(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">For a full correction (bands, conditions), re-import the instrument instead. This only fixes minimum/maximum/fixed/unit figures in place.</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Minimum</label>
                <input className="input text-sm" type="number" value={editingRule.minimum} onChange={e => setEditingRule({ ...editingRule, minimum: e.target.value })} />
              </div>
              <div>
                <label className="label">Maximum</label>
                <input className="input text-sm" type="number" value={editingRule.maximum} onChange={e => setEditingRule({ ...editingRule, maximum: e.target.value })} />
              </div>
              <div>
                <label className="label">Fixed Amount</label>
                <input className="input text-sm" type="number" value={editingRule.fixed_amount} onChange={e => setEditingRule({ ...editingRule, fixed_amount: e.target.value })} />
              </div>
              <div>
                <label className="label">Unit Rate</label>
                <input className="input text-sm" type="number" value={editingRule.unit_rate} onChange={e => setEditingRule({ ...editingRule, unit_rate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveRuleEdit} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
              <button onClick={() => setEditingRule(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
