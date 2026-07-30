'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Star, ArchiveRestore, Gavel } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState, SearchInput, FilterTabs,
} from '@/components/admin/ui'

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
  const [search, setSearch] = useState('')
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
      const res = await fetch('/api/case-results', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'Case result added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Move this case result to trash?')) return
    const res = await fetch(`/api/case-results?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/case-results', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
  }

  const filtered = results.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.title.toLowerCase().includes(q) || r.outcome.toLowerCase().includes(q) || (r.practice_area || '').toLowerCase().includes(q)
  })
  const featured = results.filter(r => r.is_featured).length

  const addButton = (
    <button onClick={() => { setEditing({ is_featured: false }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Result
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={Gavel}
        eyebrow="Website content"
        title="Case Results"
        description="Anonymise client identities. Never publish a real party name here."
        meta={[
          `${filtered.length} ${trash ? 'in trash' : 'result' + (filtered.length === 1 ? '' : 's')}`,
          !trash && featured > 0 ? `${featured} featured` : null,
        ]}
        actions={!trash && addButton}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, outcome or practice area…" />
        <FilterTabs
          value={trash ? 'trash' : 'live'}
          onChange={v => setTrash(v === 'trash')}
          options={[{ value: 'live', label: 'Live' }, { value: 'trash', label: 'Trash' }]}
        />
      </PageHeader>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={search ? 'No results match that search' : trash ? 'Nothing in trash' : 'No case results yet'}
          description={search ? 'Try a different word, or clear the search.' : undefined}
          action={!search && !trash && addButton}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => (
            <div key={r.id} className="card p-4 flex items-start justify-between gap-3 group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {r.is_featured && <Star className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-brand)] fill-[var(--color-brand)]" />}
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{r.title}</h3>
                  <StatusPill tone="safe">{r.outcome}</StatusPill>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] flex-wrap">
                  {[r.practice_area, r.client_type, r.year].filter(Boolean).map((v, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="opacity-40">·</span>}
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {trash ? (
                  <button onClick={() => restore(r.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(r); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(r.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Case Result' : 'Edit Case Result'}
        description="Anonymised only. No real party names."
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add Result' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={editing?.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Landmark Commercial Dispute Resolution" />
        </div>
        <div>
          <label className="label">Outcome (headline figure) *</label>
          <input className="input text-sm" value={editing?.outcome || ''} onChange={e => setEditing({ ...editing, outcome: e.target.value })} placeholder="KES 45M Settlement, or Case Dismissed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Practice Area</label>
            <input className="input text-sm" value={editing?.practice_area || ''} onChange={e => setEditing({ ...editing, practice_area: e.target.value })} />
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input text-sm" value={editing?.year || ''} onChange={e => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
        </div>
        <div>
          <label className="label">Client Type (anonymised only)</label>
          <input className="input text-sm" value={editing?.client_type || ''} onChange={e => setEditing({ ...editing, client_type: e.target.value })} placeholder="Corporate Client, Individual, NGO…" />
        </div>
        <div>
          <label className="label">Summary</label>
          <textarea rows={2} className="input text-sm" value={editing?.summary || ''} onChange={e => setEditing({ ...editing, summary: e.target.value })} placeholder="One or two lines shown on the homepage card" />
        </div>
        <div>
          <label className="label">Full Description</label>
          <textarea rows={4} className="input text-sm" value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editing?.is_featured || false} onChange={e => setEditing({ ...editing, is_featured: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Featured on homepage</span>
        </label>
      </Modal>
    </div>
  )
}
