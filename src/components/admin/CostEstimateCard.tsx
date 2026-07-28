'use client'
import { useEffect, useState } from 'react'
import { Calculator, Loader2, Plus, ChevronDown, Trash2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import SectionCard from '@/components/admin/SectionCard'
import { SECTION_COLORS } from '@/lib/sectionColors'

interface Suggestion {
  rule: { id: string; name: string; paragraph: string | null; currency: string }
  schedule: { number: string; title: string }
  instrument: { name: string; version: string }
  explanation: { plain_language: string; legal_reference: string | null } | null
  result: { amount: number; steps: string[] }
}

interface MatterFee {
  id: string
  category: 'court_cost' | 'advocate_fee' | 'government_charge' | 'disbursement' | 'tax'
  name: string
  amount: number
  vat_applicable: boolean
  vat_amount: number
  recoverable: string | null
  status: 'estimated' | 'confirmed' | 'paid'
  explanation: { plain_language?: string; legal_reference?: string } | null
  creator?: { full_name: string } | null
  created_at: string
}

interface Forecast {
  id: string
  stage_label: string
  expected_cost: number
  confidence: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  court_cost: 'Court Costs',
  advocate_fee: 'Advocate Fees',
  government_charge: 'Government Charges',
  disbursement: 'Disbursements',
  tax: 'Tax',
}
const CATEGORY_ORDER = ['court_cost', 'advocate_fee', 'government_charge', 'disbursement', 'tax']

export default function CostEstimateCard({ matterId, invoked, onData }: {
  matterId: string
  // Result, not process: stays out of sight until there's an accepted
  // cost on record, or the matter page invokes it as a stage-related task.
  invoked: boolean
  onData?: (hasFees: boolean) => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [fees, setFees] = useState<MatterFee[]>([])
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ category: 'disbursement', name: '', amount: '' })
  const [savingManual, setSavingManual] = useState(false)
  const [showForecastForm, setShowForecastForm] = useState(false)
  const [forecastForm, setForecastForm] = useState({ stage_label: '', expected_cost: '', confidence: 'medium' })
  const [expandedSuggestion, setExpandedSuggestion] = useState<Record<string, boolean>>({})

  function load() {
    setLoading(true)
    Promise.all([
      fetch(`/api/legal-instruments/resolve?matter_id=${matterId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/matter-fees?matter_id=${matterId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/cost-forecasts?matter_id=${matterId}`).then(r => r.json()).catch(() => []),
    ]).then(([s, f, c]) => {
      setSuggestions(Array.isArray(s) ? s : [])
      const feeList = Array.isArray(f) ? f : []
      setFees(feeList)
      setForecasts(Array.isArray(c) ? c : [])
      onData?.(feeList.length > 0)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [matterId])

  async function acceptSuggestion(s: Suggestion) {
    setAccepting(s.rule.id)
    try {
      const res = await fetch('/api/matter-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matter_id: matterId,
          rule_id: s.rule.id,
          category: 'advocate_fee',
          name: s.rule.name,
          amount: s.result.amount,
          vat_applicable: true,
          explanation: { plain_language: s.explanation?.plain_language, legal_reference: s.explanation?.legal_reference, steps: s.result.steps, instrument: s.instrument, schedule: s.schedule },
        }),
      })
      if (res.ok) { toast.success('Added to matter costs'); load() }
      else toast.error('Could not add')
    } finally {
      setAccepting(null)
    }
  }

  async function addManual() {
    if (!manualForm.name.trim() || !manualForm.amount) { toast.error('Name and amount are required'); return }
    setSavingManual(true)
    try {
      const res = await fetch('/api/matter-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId, category: manualForm.category, name: manualForm.name.trim(), amount: Number(manualForm.amount) }),
      })
      if (res.ok) { toast.success('Cost added'); setShowManual(false); setManualForm({ category: 'disbursement', name: '', amount: '' }); load() }
      else toast.error('Could not add')
    } finally {
      setSavingManual(false)
    }
  }

  async function removeFee(id: string) {
    if (!confirm('Remove this cost?')) return
    const res = await fetch(`/api/matter-fees/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); load() }
    else toast.error('Could not remove')
  }

  async function markStatus(id: string, status: 'confirmed' | 'paid') {
    const res = await fetch(`/api/matter-fees/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) load()
    else toast.error('Could not update')
  }

  async function addForecast() {
    if (!forecastForm.stage_label.trim() || !forecastForm.expected_cost) { toast.error('Stage and expected cost are required'); return }
    const res = await fetch('/api/cost-forecasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matter_id: matterId, stage_label: forecastForm.stage_label.trim(), expected_cost: Number(forecastForm.expected_cost), confidence: forecastForm.confidence }),
    })
    if (res.ok) { setShowForecastForm(false); setForecastForm({ stage_label: '', expected_cost: '', confidence: 'medium' }); load() }
    else toast.error('Could not add forecast')
  }

  async function removeForecast(id: string) {
    const res = await fetch(`/api/cost-forecasts?id=${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const subtotal = fees.reduce((sum, f) => sum + f.amount, 0)
  const vatTotal = fees.reduce((sum, f) => sum + (f.vat_applicable ? f.amount * 0.16 : 0), 0)
  const total = subtotal + vatTotal

  if (loading) {
    // Avoid flashing a loading card for something that may turn out empty
    // and hidden, only show it while loading if it was actively invoked.
    if (!invoked) return null
    return (
      <div className="card p-6 mb-6 border-l-[3px]" style={{ borderLeftColor: SECTION_COLORS.gold }}>
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" /></div>
      </div>
    )
  }

  // Result, not process: nothing accepted yet and nobody asked to estimate
  // costs at this stage, stay out of the way.
  if (fees.length === 0 && !invoked) return null

  return (
    <SectionCard title="Cost Estimate" icon={Calculator} color="gold" defaultOpen>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">Suggested from the firm&apos;s fee schedules, fully explainable. Review before quoting a client.</p>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {suggestions.map(s => {
            const key = s.rule.id
            const isOpen = expandedSuggestion[key] ?? false
            return (
              <div key={key} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-3">
                  <button onClick={() => setExpandedSuggestion(e => ({ ...e, [key]: !isOpen }))} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.rule.name}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-2">{formatCurrency(s.result.amount)}</span>
                    </div>
                  </button>
                  <button onClick={() => acceptSuggestion(s)} disabled={accepting === s.rule.id} className="btn btn-outline text-xs gap-1 flex-shrink-0">
                    {accepting === s.rule.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Accept
                  </button>
                </div>
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
      )}

      {fees.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)] mb-3">No costs recorded on this matter yet.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-3">
          {CATEGORY_ORDER.filter(cat => fees.some(f => f.category === cat)).map(cat => (
            <div key={cat}>
              <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1.5">{CATEGORY_LABEL[cat]}</div>
              <div className="flex flex-col gap-1.5">
                {fees.filter(f => f.category === cat).map(f => (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                    <div className="min-w-0">
                      <span className="text-sm text-[var(--color-text-primary)]">{f.name}</span>
                      {f.vat_applicable && <span className="text-xs text-[var(--color-muted)] ml-2">+16% VAT</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatCurrency(f.amount)}</span>
                      <span className={`badge text-xs ${f.status === 'paid' ? 'status-active' : f.status === 'confirmed' ? 'status-review' : 'status-pending'}`}>{f.status}</span>
                      {f.status === 'estimated' && (
                        <button onClick={() => markStatus(f.id, 'confirmed')} title="Confirm" className="btn btn-ghost p-1 !px-1 text-[var(--color-accent)]"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => removeFee(f.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-[var(--color-border)] flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {vatTotal > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>VAT (16%)</span><span>{formatCurrency(vatTotal)}</span></div>}
            <div className="flex justify-between font-semibold text-[var(--color-text-primary)]"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => setShowManual(v => !v)} className="btn btn-outline text-xs gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Manual Cost</button>
      </div>
      {showManual && (
        <div className="flex flex-wrap gap-2 items-end mb-4 p-3 rounded-md bg-[var(--color-surface-overlay)]">
          <select className="input text-sm" value={manualForm.category} onChange={e => setManualForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <input className="input text-sm flex-1 min-w-32" placeholder="Description" value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} />
          <input type="number" className="input text-sm w-32" placeholder="Amount" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} />
          <button onClick={addManual} disabled={savingManual} className="btn btn-primary text-xs">{savingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}</button>
        </div>
      )}

      <details className="pt-3 border-t border-[var(--color-border)]">
        <summary className="text-xs text-[var(--color-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-accent)]">
          Forecast ({forecasts.length})
        </summary>
        <div className="flex flex-col gap-1.5 mt-3">
          {forecasts.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-md bg-[var(--color-surface-overlay)] text-xs">
              <span className="text-[var(--color-text-primary)]">{f.stage_label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-secondary)]">{formatCurrency(f.expected_cost)}</span>
                {f.confidence && <span className="text-[var(--color-muted)]">{f.confidence} confidence</span>}
                <button onClick={() => removeForecast(f.id)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
          {showForecastForm ? (
            <div className="flex flex-wrap gap-2 items-end mt-1">
              <input className="input text-xs flex-1 min-w-28" placeholder="Stage (e.g. Upon Filing)" value={forecastForm.stage_label} onChange={e => setForecastForm(f => ({ ...f, stage_label: e.target.value }))} />
              <input type="number" className="input text-xs w-28" placeholder="Expected cost" value={forecastForm.expected_cost} onChange={e => setForecastForm(f => ({ ...f, expected_cost: e.target.value }))} />
              <select className="input text-xs" value={forecastForm.confidence} onChange={e => setForecastForm(f => ({ ...f, confidence: e.target.value }))}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
              <button onClick={addForecast} className="btn btn-primary text-xs">Add</button>
            </div>
          ) : (
            <button onClick={() => setShowForecastForm(true)} className="btn btn-ghost text-xs gap-1 self-start mt-1"><Plus className="w-3 h-3" /> Add Forecast Line</button>
          )}
        </div>
      </details>
    </SectionCard>
  )
}
