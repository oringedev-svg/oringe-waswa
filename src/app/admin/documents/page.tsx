'use client'
import { useEffect, useState } from 'react'
import { Upload, Trash2, Loader2, X, FileText, Lock, Search, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { LegalDocument, LegalMatter, DocumentType, FileAccessLevel } from '@/types'

const DOC_TYPES: DocumentType[] = [
  'pleading', 'motion', 'brief', 'contract', 'affidavit', 'exhibit',
  'correspondence', 'court_order', 'evidence', 'invoice', 'memo', 'research', 'other',
]
const ACCESS_LEVELS: FileAccessLevel[] = ['public', 'client', 'staff', 'admin', 'confidential']

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([])
  const [matters, setMatters] = useState<LegalMatter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [matterFilter, setMatterFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    matter_id: '', title: '', type: 'other' as DocumentType,
    description: '', access_level: 'staff' as FileAccessLevel, is_privileged: false,
  })
  const [file, setFile] = useState<File | null>(null)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (matterFilter) params.set('matter_id', matterFilter)
    if (typeFilter) params.set('type', typeFilter)
    if (search) params.set('search', search)
    fetch(`/api/files/documents?${params}`)
      .then((r) => r.json())
      .then((d) => setDocuments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [typeFilter, matterFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/files/matters?limit=200')
      .then((r) => r.json())
      .then((d) => setMatters(d?.data || []))
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  async function upload() {
    if (!file) { toast.error('Choose a file'); return }
    if (!form.matter_id) { toast.error('Select a matter to attach this document to'); return }
    if (!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('matter_id', form.matter_id)
      fd.append('title', form.title)
      fd.append('type', form.type)
      fd.append('description', form.description)
      fd.append('access_level', form.access_level)
      fd.append('is_privileged', String(form.is_privileged))
      fd.append('tags', '[]')
      const res = await fetch('/api/files/documents', { method: 'POST', body: fd })
      if (res.ok) {
        toast.success('Document uploaded')
        setUploadOpen(false)
        setFile(null)
        setForm({ matter_id: '', title: '', type: 'other', description: '', access_level: 'staff', is_privileged: false })
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Upload failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/files/documents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Document deleted'); load() }
    else toast.error('Delete failed')
  }

  function formatBytes(bytes: number) {
    if (!bytes) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0, n = bytes
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
    return `${n.toFixed(1)} ${units[i]}`
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="eyebrow mb-2">Legal</p>
          <h1 className="font-display font-semibold" style={{ fontSize: 'var(--heading-page-size)' }}>Documents</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Files attached to legal matters, pleadings, contracts, correspondence, evidence.</p>
        </div>
        <button onClick={() => setUploadOpen(true)} className="btn btn-primary">
          <Upload className="w-4 h-4" /> Upload document
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input className="input pl-9" placeholder="Search by title or file name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <select className="input w-auto" value={matterFilter} onChange={(e) => setMatterFilter(e.target.value)}>
          <option value="">All matters</option>
          {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_number}, {m.title}</option>)}
        </select>
        <button className="btn btn-outline" type="submit">Search</button>
      </form>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" /></div>
      ) : documents.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-8 h-8 mx-auto mb-3 text-[var(--color-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">No documents match these filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Matter</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {doc.is_privileged && <Lock className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-label="Privileged" />}
                      <span className="font-medium text-[var(--color-text-primary)]">{doc.title}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">{doc.file_name}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{doc.matter?.matter_number || '-'}</td>
                  <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">{doc.type?.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><span className="badge text-[var(--color-accent)]">{doc.access_level}</span></td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatBytes(doc.file_size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-ghost p-2 !px-2" title="Download">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => remove(doc.id)} className="btn btn-ghost p-2 !px-2 text-red-600" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setUploadOpen(false)} />
          <div className="relative w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
              <h3 className="font-display font-semibold text-lg">Upload document</h3>
              <button onClick={() => setUploadOpen(false)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">File</label>
                <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="label">Matter</label>
                <select className="input" value={form.matter_id} onChange={(e) => setForm({ ...form, matter_id: e.target.value })}>
                  <option value="">Select a matter…</option>
                  {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_number}, {m.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DocumentType })}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Access level</label>
                  <select className="input" value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value as FileAccessLevel })}>
                    {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={form.is_privileged} onChange={(e) => setForm({ ...form, is_privileged: e.target.checked })} />
                Covered by legal professional privilege
              </label>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
              <button className="btn btn-ghost" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={upload} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
