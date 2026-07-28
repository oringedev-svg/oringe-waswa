'use client'
import { useState } from 'react'
import { Calculator, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { MATTER_TYPES } from '@/lib/utils'
import { KENYA_COUNTIES } from '@/lib/kenyaCounties'
import { formatCurrency } from '@/lib/utils'

interface Suggestion {
  rule: { id: string; name: string; paragraph: string | null; currency: string }
  schedule: { number: string; title: string }
  instrument: { name: string; version: string }
  explanation: { plain_language: string; legal_reference: string | null } | null
  result: { amount: number; steps: string[] }
}

export default function AroCalculatorPage() {
  const [form, setForm] = useState({ type: '', claim_value: '', county: '' })
  const [calculating, setCalculating] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function calculate() {
    if (!form.type) { toast.error('Select a matter type'); return }
    setCalculating(true)
    try {
      const params = new URLSearchParams({ type: form.type })
      if (form.claim_value) params.set('claim_value', form.claim_value)
      if (form.county) params.set('county', form.county)
      const res = await fetch(`/api/legal-instruments/resolve?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data : [])
        setHasRun(true)
      } else {
        toast.error('Could not calculate')
      }
    } finally {
      setCalculating(false)
    }
  }

  const total = suggestions.reduce((sum, s) => sum + s.result.amount, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">ARO Calculator</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Quote a prospective client before a matter exists, the same fee schedules and calculation logic as a
          matter&apos;s Cost Estimate, applied to hypothetical inputs. Nothing here is saved; open a matter to record
          an accepted cost on file.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end mb-6 max-w-2xl">
        <div className="flex-1 min-w-40">
          <label className="label">Matter Type</label>
          <select className="input text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">Select…</option>
            {MATTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="w-40">
          <label className="label">Claim Value (KSh)</label>
          <input type="number" className="input text-sm" placeholder="Optional" value={form.claim_value} onChange={e => setForm(f => ({ ...f, claim_value: e.target.value }))} />
        </div>
        <div className="w-44">
          <label className="label">County</label>
          <select className="input text-sm" value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))}>
            <option value="">Optional</option>
            {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={calculate} disabled={calculating} className="btn btn-primary gap-2 text-sm">
          {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          Calculate
        </button>
      </div>

      {hasRun && (
        <div className="max-w-2xl">
          {suggestions.length === 0 ? (
            <div className="card p-6 text-sm text-[var(--color-muted)]">
              No active fee rule matches these inputs. Check the Fee Schedules for what's configured for this matter type.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 mb-3">
                {suggestions.map(s => {
                  const key = s.rule.id
                  const isOpen = expanded[key] ?? false
                  return (
                    <div key={key} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                      <button onClick={() => setExpanded(e => ({ ...e, [key]: !isOpen }))} className="w-full flex items-center justify-between gap-2 p-3 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.rule.name}</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] flex-shrink-0">{formatCurrency(s.result.amount)}</span>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 text-xs text-[var(--color-text-secondary)] flex flex-col gap-1.5">
                          {s.explanation?.plain_language && <p>{s.explanation.plain_language}</p>}
                          <p className="text-[var(--color-muted)]">
                            {s.instrument.name} ({s.instrument.version}), Schedule {s.schedule.number}
                            {s.rule.paragraph ? `, ¶${s.rule.paragraph}` : ''}
                            {s.explanation?.legal_reference ? `, ${s.explanation.legal_reference}` : ''}
                          </p>
                          <div className="flex flex-col gap-0.5 mt-1 pt-1.5 border-t border-[var(--color-border)]">
                            {s.result.steps.map((step, i) => <span key={i} className="text-[var(--color-muted)]">{step}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="pt-3 border-t border-[var(--color-border)] flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Estimated Total (excl. VAT and disbursements)</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(total)}</span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-2">Statutory estimate only, subject to the Advocates Remuneration Order. Confirm before quoting a client.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
