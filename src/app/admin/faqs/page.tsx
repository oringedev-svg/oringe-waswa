'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, ArchiveRestore, EyeOff, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState, SearchInput, FilterTabs,
} from '@/components/admin/ui'

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
  const [search, setSearch] = useState('')
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
      const res = await fetch('/api/faqs', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (res.ok) { toast.success(isNew ? 'FAQ added' : 'Saved'); setEditing(null); load() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Move this FAQ to trash?')) return
    const res = await fetch(`/api/faqs?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/faqs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
  }

  const filtered = faqs.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || (f.category || '').toLowerCase().includes(q)
  })
  const hidden = faqs.filter(f => !f.is_active).length

  return (
    <div>
      <PageHeader
        icon={HelpCircle}
        eyebrow="Website content"
        title="FAQs"
        description="Shown on the Contact page, in display order."
        meta={[
          `${filtered.length} ${trash ? 'in trash' : 'question' + (filtered.length === 1 ? '' : 's')}`,
          !trash && hidden > 0 ? `${hidden} hidden from site` : null,
        ]}
        actions={!trash && (
          <button onClick={() => { setEditing({ category: 'General', is_active: true }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add FAQ
          </button>
        )}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search questions and answers…" />
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
          icon={HelpCircle}
          title={search ? 'No FAQs match that search' : trash ? 'Nothing in trash' : 'No FAQs yet'}
          description={search ? 'Try a different word, or clear the search.' : trash ? undefined : 'Add the questions clients ask most often before they call.'}
          action={!search && !trash && (
            <button onClick={() => { setEditing({ category: 'General', is_active: true }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(f => (
            <div key={f.id} className="card p-4 flex items-start justify-between gap-3 group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)]">{f.question}</h3>
                  {f.category && <StatusPill>{f.category}</StatusPill>}
                  {!f.is_active && (
                    <span className="inline-flex items-center gap-1 text-[0.68rem] text-[var(--color-text-muted)]">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 max-w-2xl">{f.answer}</p>
              </div>
              {/* Row actions stay dim until the row is hovered or focused so
                  a long list reads as content rather than as a grid of icons. */}
              <div className="flex gap-1 flex-shrink-0 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {trash ? (
                  <button onClick={() => restore(f.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(f); setIsNew(false) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(f.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
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
        title={isNew ? 'Add FAQ' : 'Edit FAQ'}
        size="md"
        footer={
          <>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isNew ? 'Add FAQ' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Question *</label>
          <input className="input text-sm" value={editing?.question || ''} onChange={e => setEditing({ ...editing, question: e.target.value })} />
        </div>
        <div>
          <label className="label">Answer *</label>
          <textarea rows={4} className="input text-sm" value={editing?.answer || ''} onChange={e => setEditing({ ...editing, answer: e.target.value })} />
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input text-sm" value={editing?.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="General, Fees, Process…" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={editing?.is_active ?? true} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Visible on site</span>
        </label>
      </Modal>
    </div>
  )
}
