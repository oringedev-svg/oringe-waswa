'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, ArchiveRestore, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Faq {
  id: string
  question: string
  answer: string
  category?: string
  is_active: boolean
}

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<Faq> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ all: 'true' })
    if (trash) params.set('trash', 'true')
    fetch(`/api/faqs?${params}`)
      .then(r => r.json())
      .then(d => setFaqs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function save() {
    if (!editing?.question || !editing?.answer) { toast.error('Question and answer are required'); return }
    setSaving(true)
    try {
      const res = isNew
        ? await fetch('/api/faqs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch('/api/faqs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNew ? 'FAQ added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Move this FAQ to trash?')) return
    const res = await fetch(`/api/faqs?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/faqs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">FAQs</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{faqs.length} questions {trash ? 'in trash' : ''}, shown on the Contact page.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTrash(!trash)} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          {!trash && (
            <button onClick={() => { setEditing({ category: 'General', is_active: true }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : faqs.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No FAQs found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {faqs.map(f => (
            <div key={f.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {!f.is_active && <EyeOff className="w-3.5 h-3.5 text-[var(--color-muted)]" />}
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{f.question}</h3>
                  {f.category && <span className="badge text-xs">{f.category}</span>}
                </div>
                <p className="text-xs text-[var(--color-muted)] line-clamp-2 max-w-xl">{f.answer}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {trash ? (
                  <button onClick={() => restore(f.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--color-accent)]"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(f); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(f.id)} className="btn btn-ghost p-1.5 !px-1.5 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add FAQ' : 'Edit FAQ'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Question *</label>
                <input className="input text-sm" value={editing.question || ''} onChange={e => setEditing({ ...editing, question: e.target.value })} />
              </div>
              <div>
                <label className="label">Answer *</label>
                <textarea rows={4} className="input text-sm" value={editing.answer || ''} onChange={e => setEditing({ ...editing, answer: e.target.value })} />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input text-sm" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="General, Fees, Process…" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Visible on site</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isNew ? 'Add FAQ' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
