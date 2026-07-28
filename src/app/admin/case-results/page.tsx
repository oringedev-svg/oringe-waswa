'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, Loader2, X, Archive, ArchiveRestore } from 'lucide-react'
import toast from 'react-hot-toast'

interface CaseResult {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  description?: string
  client_type?: string
  year?: number
  is_featured: boolean
}

export default function AdminCaseResultsPage() {
  const [results, setResults] = useState<CaseResult[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<CaseResult> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    fetch(`/api/case-results?${params}`)
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.title || !editing?.outcome) { toast.error('Title and outcome are required'); return }
    setSaving(true)
    try {
      const res = isNew
        ? await fetch('/api/case-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/case-results', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'Case result added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Move this case result to trash?')) return
    const res = await fetch(`/api/case-results?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/case-results', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Case Results</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{results.length} results {trash ? 'in trash' : ''}, anonymize client identities, never use real names here.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTrash(!trash)} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          {!trash && (
            <button onClick={() => { setEditing({ is_featured: false }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Result
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : results.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No case results found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map(r => (
            <div key={r.id} className="card p-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {r.is_featured && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{r.title}</h3>
                  <span className="badge status-active text-xs">{r.outcome}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] flex-wrap">
                  {r.practice_area && <span>{r.practice_area}</span>}
                  {r.client_type && <span>{r.client_type}</span>}
                  {r.year && <span>{r.year}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {trash ? (
                  <button onClick={() => restore(r.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(r); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(r.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Case Result' : 'Edit Case Result'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Landmark Commercial Dispute Resolution" />
              </div>
              <div>
                <label className="label">Outcome (headline figure) *</label>
                <input className="input text-sm" value={editing.outcome || ''} onChange={e => setEditing({ ...editing, outcome: e.target.value })} placeholder="KES 45M Settlement, or Case Dismissed" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Practice Area</label>
                  <input className="input text-sm" value={editing.practice_area || ''} onChange={e => setEditing({ ...editing, practice_area: e.target.value })} />
                </div>
                <div>
                  <label className="label">Year</label>
                  <input type="number" className="input text-sm" value={editing.year || ''} onChange={e => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
              <div>
                <label className="label">Client Type (anonymized only)</label>
                <input className="input text-sm" value={editing.client_type || ''} onChange={e => setEditing({ ...editing, client_type: e.target.value })} placeholder="Corporate Client, Individual, NGO…" />
              </div>
              <div>
                <label className="label">Summary</label>
                <textarea rows={2} className="input text-sm" value={editing.summary || ''} onChange={e => setEditing({ ...editing, summary: e.target.value })} placeholder="One or two lines shown on the homepage card" />
              </div>
              <div>
                <label className="label">Full Description</label>
                <textarea rows={4} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_featured || false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Featured on homepage</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add Result' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
