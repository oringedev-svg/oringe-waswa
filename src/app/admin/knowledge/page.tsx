'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Search, ChevronDown, Lightbulb, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { MATTER_TYPES } from '@/lib/utils'

interface Solution {
  id: string
  problem_id: string
  priority: number
  solution: string
  prerequisite: string | null
  is_court_track: boolean
  notes: string | null
}

interface Problem {
  id: string
  category: string
  matter_type: string | null
  title: string
  description: string | null
  keywords: string[]
  typical_client: string | null
  limitation_period: string | null
  display_order: number
  solutions: Solution[]
}

interface CourtRule {
  id: string
  category: string
  label: string
  min_value: number | null
  max_value: number | null
  court_name: string
  registry_notes: string | null
  display_order: number
}

const COURT_CATEGORIES = ['civil_commercial', 'land', 'employment', 'family', 'muslim_personal', 'criminal_minor', 'criminal_capital', 'constitutional', 'appeal', 'election_petition']

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState<'problems' | 'courts'>('problems')

  // Problems & Solutions state
  const [problems, setProblems] = useState<Problem[]>([])
  const [loadingProblems, setLoadingProblems] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingProblem, setEditingProblem] = useState<Partial<Problem> & { keywordsText?: string } | null>(null)
  const [isNewProblem, setIsNewProblem] = useState(false)
  const [savingProblem, setSavingProblem] = useState(false)
  const [solutionDraft, setSolutionDraft] = useState<Record<string, { solution: string; prerequisite: string; is_court_track: boolean }>>({})
  const [addingSolutionTo, setAddingSolutionTo] = useState<string | null>(null)

  // Court Rules state
  const [rules, setRules] = useState<CourtRule[]>([])
  const [loadingRules, setLoadingRules] = useState(true)
  const [editingRule, setEditingRule] = useState<Partial<CourtRule> | null>(null)
  const [isNewRule, setIsNewRule] = useState(false)
  const [savingRule, setSavingRule] = useState(false)

  function loadProblems() {
    setLoadingProblems(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    fetch(`/api/legal-knowledge/problems?${params}`)
      .then(r => r.json())
      .then(d => setProblems(Array.isArray(d) ? d : []))
      .finally(() => setLoadingProblems(false))
  }

  function loadRules() {
    setLoadingRules(true)
    fetch('/api/legal-knowledge/court-rules')
      .then(r => r.json())
      .then(d => setRules(Array.isArray(d) ? d : []))
      .finally(() => setLoadingRules(false))
  }

  useEffect(() => { loadProblems() }, [search, categoryFilter])
  useEffect(() => { loadRules() }, [])

  const categories = Array.from(new Set(problems.map(p => p.category))).sort()

  async function saveProblem() {
    if (!editingProblem?.title) { toast.error('Title is required'); return }
    setSavingProblem(true)
    try {
      const payload = {
        ...editingProblem,
        keywords: (editingProblem.keywordsText ?? (editingProblem.keywords || []).join(', ')).split(',').map(s => s.trim()).filter(Boolean),
      }
      delete (payload as { keywordsText?: string }).keywordsText
      delete (payload as { solutions?: Solution[] }).solutions
      const res = isNewProblem
        ? await fetch('/api/legal-knowledge/problems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/legal-knowledge/problems', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast.success(isNewProblem ? 'Problem added' : 'Saved'); setEditingProblem(null); loadProblems() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally {
      setSavingProblem(false)
    }
  }

  async function deleteProblem(id: string) {
    if (!confirm('Move this problem (and its solutions) to trash?')) return
    const res = await fetch(`/api/legal-knowledge/problems?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); loadProblems() }
    else toast.error('Delete failed')
  }

  async function addSolution(problemId: string) {
    const draft = solutionDraft[problemId]
    if (!draft?.solution?.trim()) { toast.error('Solution is required'); return }
    setAddingSolutionTo(problemId)
    try {
      const problem = problems.find(p => p.id === problemId)
      const nextPriority = (problem?.solutions.length || 0) + 1
      const res = await fetch('/api/legal-knowledge/solutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: problemId, priority: nextPriority, solution: draft.solution.trim(), prerequisite: draft.prerequisite || null, is_court_track: draft.is_court_track || false }),
      })
      if (res.ok) { setSolutionDraft(d => ({ ...d, [problemId]: { solution: '', prerequisite: '', is_court_track: false } })); loadProblems() }
      else toast.error('Could not add solution')
    } finally {
      setAddingSolutionTo(null)
    }
  }

  async function deleteSolution(id: string) {
    if (!confirm('Remove this solution?')) return
    const res = await fetch(`/api/legal-knowledge/solutions?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); loadProblems() }
    else toast.error('Delete failed')
  }

  async function saveRule() {
    if (!editingRule?.label || !editingRule?.court_name || !editingRule?.category) { toast.error('Category, label, and court name are required'); return }
    setSavingRule(true)
    try {
      const res = isNewRule
        ? await fetch('/api/legal-knowledge/court-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingRule) })
        : await fetch('/api/legal-knowledge/court-rules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingRule) })
      if (res.ok) { toast.success(isNewRule ? 'Rule added' : 'Saved'); setEditingRule(null); loadRules() }
      else toast.error((await res.json()).error || 'Save failed')
    } finally {
      setSavingRule(false)
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Move this court routing rule to trash?')) return
    const res = await fetch(`/api/legal-knowledge/court-rules?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); loadRules() }
    else toast.error('Delete failed')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Legal Knowledge</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">The problem/solution library and court routing rules behind the automatic suggestions on matters and submissions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('problems')} className={`btn gap-2 text-sm ${tab === 'problems' ? 'btn-primary' : 'btn-outline'}`}>
            <Lightbulb className="w-4 h-4" /> Problems &amp; Solutions
          </button>
          <button onClick={() => setTab('courts')} className={`btn gap-2 text-sm ${tab === 'courts' ? 'btn-primary' : 'btn-outline'}`}>
            <Scale className="w-4 h-4" /> Court Routing Rules
          </button>
        </div>
      </div>

      {tab === 'problems' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
              <input className="input pl-9 text-sm" placeholder="Search problems…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input text-sm w-48" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => { setEditingProblem({ display_order: problems.length, keywords: [] }); setIsNewProblem(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Problem
            </button>
          </div>

          {loadingProblems ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : problems.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">No problems found.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {problems.map(p => {
                const isOpen = expanded[p.id] ?? false
                return (
                  <div key={p.id} className="card overflow-hidden">
                    <div className="flex items-center justify-between gap-2 p-4">
                      <button onClick={() => setExpanded(e => ({ ...e, [p.id]: !isOpen }))} className="flex-1 flex items-center gap-3 text-left min-w-0">
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{p.title}</span>
                            <span className="badge status-review text-xs">{p.category}</span>
                            <span className="text-xs text-[var(--color-muted)]">{p.solutions.length} solution{p.solutions.length === 1 ? '' : 's'}</span>
                          </div>
                          {p.description && <p className="text-xs text-[var(--color-muted)] line-clamp-1 mt-0.5">{p.description}</p>}
                        </div>
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditingProblem({ ...p, keywordsText: (p.keywords || []).join(', ') }); setIsNewProblem(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteProblem(p.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                        {p.solutions.slice().sort((a, b) => a.priority - b.priority).map(s => (
                          <div key={s.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-md bg-[var(--color-surface-overlay)]">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-[var(--color-accent)]">{s.priority}.</span>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.solution}</span>
                                {s.is_court_track && <span className="badge status-pending text-xs">Court Track</span>}
                              </div>
                              {s.prerequisite && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.prerequisite}</p>}
                            </div>
                            <button onClick={() => deleteSolution(s.id)} className="btn btn-ghost p-1 !px-1 text-red-500 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}

                        <div className="flex flex-wrap gap-2 items-end mt-2 pt-2 border-t border-[var(--color-border)]">
                          <input className="input text-xs flex-1 min-w-32" placeholder="New solution…" value={solutionDraft[p.id]?.solution || ''}
                            onChange={e => setSolutionDraft(d => ({ ...d, [p.id]: { ...d[p.id], solution: e.target.value, prerequisite: d[p.id]?.prerequisite || '', is_court_track: d[p.id]?.is_court_track || false } }))} />
                          <input className="input text-xs flex-1 min-w-32" placeholder="Prerequisite (optional)" value={solutionDraft[p.id]?.prerequisite || ''}
                            onChange={e => setSolutionDraft(d => ({ ...d, [p.id]: { ...d[p.id], prerequisite: e.target.value, solution: d[p.id]?.solution || '', is_court_track: d[p.id]?.is_court_track || false } }))} />
                          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                            <input type="checkbox" checked={solutionDraft[p.id]?.is_court_track || false}
                              onChange={e => setSolutionDraft(d => ({ ...d, [p.id]: { ...d[p.id], is_court_track: e.target.checked, solution: d[p.id]?.solution || '', prerequisite: d[p.id]?.prerequisite || '' } }))} />
                            Court track
                          </label>
                          <button onClick={() => addSolution(p.id)} disabled={addingSolutionTo === p.id} className="btn btn-outline text-xs gap-1">
                            {addingSolutionTo === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'courts' && (
        <div>
          <div className="flex justify-end mb-5">
            <button onClick={() => { setEditingRule({ display_order: rules.length }); setIsNewRule(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>
          {loadingRules ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
          ) : rules.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">No court routing rules yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map(r => (
                <div key={r.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="badge status-review text-xs">{r.category}</span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{r.court_name}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">{r.label}</p>
                    {(r.min_value !== null || r.max_value !== null) && (
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {r.min_value !== null ? `Above Ksh ${r.min_value.toLocaleString()}` : 'Up to'} {r.max_value !== null ? `Ksh ${r.max_value.toLocaleString()}` : (r.min_value !== null ? '' : '')}
                      </p>
                    )}
                    {r.registry_notes && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{r.registry_notes}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditingRule(r); setIsNewRule(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteRule(r.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Problem edit modal */}
      {editingProblem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingProblem(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNewProblem ? 'Add Problem' : 'Edit Problem'}</h2>
              <button onClick={() => setEditingProblem(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editingProblem.title || ''} onChange={e => setEditingProblem({ ...editingProblem, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input text-sm" value={editingProblem.category || ''} onChange={e => setEditingProblem({ ...editingProblem, category: e.target.value })} placeholder="Contract, Employment, Land…" />
              </div>
              <div>
                <label className="label">Matter Type (matches suggestions to this matter type)</label>
                <select className="input text-sm" value={editingProblem.matter_type || ''} onChange={e => setEditingProblem({ ...editingProblem, matter_type: e.target.value })}>
                  <option value="">Not linked</option>
                  {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={2} className="input text-sm" value={editingProblem.description || ''} onChange={e => setEditingProblem({ ...editingProblem, description: e.target.value })} />
              </div>
              <div>
                <label className="label">Keywords (comma-separated)</label>
                <input className="input text-sm" value={editingProblem.keywordsText ?? (editingProblem.keywords || []).join(', ')} onChange={e => setEditingProblem({ ...editingProblem, keywordsText: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Typical Client</label>
                  <input className="input text-sm" value={editingProblem.typical_client || ''} onChange={e => setEditingProblem({ ...editingProblem, typical_client: e.target.value })} />
                </div>
                <div>
                  <label className="label">Limitation Period</label>
                  <input className="input text-sm" value={editingProblem.limitation_period || ''} onChange={e => setEditingProblem({ ...editingProblem, limitation_period: e.target.value })} placeholder="6 years" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveProblem} disabled={savingProblem} className="btn btn-primary flex-1 gap-2">
                {savingProblem ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNewProblem ? 'Add Problem' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingProblem(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Court rule edit modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingRule(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNewRule ? 'Add Court Rule' : 'Edit Court Rule'}</h2>
              <button onClick={() => setEditingRule(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Category *</label>
                <select className="input text-sm" value={editingRule.category || ''} onChange={e => setEditingRule({ ...editingRule, category: e.target.value })}>
                  <option value="">Select…</option>
                  {COURT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Label *</label>
                <input className="input text-sm" value={editingRule.label || ''} onChange={e => setEditingRule({ ...editingRule, label: e.target.value })} placeholder="Simple Commercial/Civil Dispute" />
              </div>
              <div>
                <label className="label">Court Name *</label>
                <input className="input text-sm" value={editingRule.court_name || ''} onChange={e => setEditingRule({ ...editingRule, court_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Min Value (Ksh)</label>
                  <input type="number" className="input text-sm" value={editingRule.min_value ?? ''} onChange={e => setEditingRule({ ...editingRule, min_value: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div>
                  <label className="label">Max Value (Ksh, blank = no limit)</label>
                  <input type="number" className="input text-sm" value={editingRule.max_value ?? ''} onChange={e => setEditingRule({ ...editingRule, max_value: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <label className="label">Registry Notes</label>
                <textarea rows={2} className="input text-sm" value={editingRule.registry_notes || ''} onChange={e => setEditingRule({ ...editingRule, registry_notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveRule} disabled={savingRule} className="btn btn-primary flex-1 gap-2">
                {savingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNewRule ? 'Add Rule' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingRule(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
