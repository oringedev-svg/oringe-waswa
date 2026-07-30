'use client'
import { useEffect, useState } from 'react'
import { Upload, Trash2, FileText, Lock, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { LegalDocument, LegalMatter, DocumentType, FileAccessLevel } from '@/types'
import {
  PageHeader, Modal, DataTable, StatusPill, EmptyState, SearchInput, type Column, type Tone,
} from '@/components/admin/ui'

const DOC_TYPES: DocumentType[] = [
  'pleading', 'motion', 'brief', 'contract', 'affidavit', 'exhibit',
  'correspondence', 'court_order', 'evidence', 'invoice', 'memo', 'research', 'other',
]
const ACCESS_LEVELS: FileAccessLevel[] = ['public', 'client', 'staff', 'admin', 'confidential']

// How far the file travels. `public` leaves the firm entirely and
// `confidential` must not, so those two are the ones the table colours.
const ACCESS_TONE: Record<string, Tone> = {
  public: 'risk',
  client: 'done',
  staff: 'safe',
  admin: 'review',
  confidential: 'overdue',
}

const EMPTY_FORM = {
  matter_id: '', title: '', type: 'other' as DocumentType,
  description: '', access_level: 'staff' as FileAccessLevel, is_privileged: false,
}

function formatBytes(bytes: number) {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${units[i]}`
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([])
  const [matters, setMatters] = useState<LegalMatter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [matterFilter, setMatterFilter] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
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
  // Search used to need a submit button because it only ran on form submit.
  // Debounced here instead, so the list narrows as you type like every
  // other list page in the admin.
  useEffect(() => {
    const t = setTimeout(load, 400)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/files/matters?limit=200')
      .then((r) => r.json())
      .then((d) => setMatters(d?.data || []))
  }, [])

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
        setForm(EMPTY_FORM)
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Upload failed')
      }
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/files/documents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Document deleted'); load() }
    else toast.error('Delete failed')
  }

  const uploadButton = (
    <button onClick={() => setUploadOpen(true)} className="btn btn-primary gap-2 text-sm">
      <Upload className="w-4 h-4" /> Upload document
    </button>
  )

  const columns: Column<LegalDocument>[] = [
    {
      label: 'Title',
      render: doc => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {doc.is_privileged && <Lock className="w-3.5 h-3.5 flex-shrink-0 text-[var(--status-danger)]" aria-label="Privileged" />}
            <span className="font-medium text-[var(--color-text-primary)] truncate">{doc.title}</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] truncate">{doc.file_name}</div>
        </div>
      ),
    },
    { label: 'Matter', secondary: true, render: doc => <span className="font-mono text-xs">{doc.matter?.matter_number || '-'}</span> },
    { label: 'Type', secondary: true, className: 'capitalize', render: doc => doc.type?.replace('_', ' ') },
    { label: 'Access', render: doc => <StatusPill tone={ACCESS_TONE[doc.access_level] || 'neutral'}>{doc.access_level}</StatusPill> },
    { label: 'Size', secondary: true, className: 'tabular-nums', render: doc => formatBytes(doc.file_size) },
    {
      label: '',
      className: 'w-24 text-right',
      render: doc => (
        <div className="flex items-center gap-1 justify-end">
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-ghost p-1.5 !px-1.5" title="Download">
            <Download className="w-4 h-4" />
          </a>
          <button onClick={() => remove(doc.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  const hasFilters = Boolean(search || typeFilter || matterFilter)

  return (
    <div>
      <PageHeader
        icon={FileText}
        eyebrow="Legal"
        title="Documents"
        description="Files attached to legal matters: pleadings, contracts, correspondence, evidence."
        meta={[`${documents.length} document${documents.length === 1 ? '' : 's'}`]}
        actions={uploadButton}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title or file name…" className="max-w-sm" />
        <select className="input !w-auto text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {DOC_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
        </select>
        <select className="input !w-auto max-w-[16rem] text-sm" value={matterFilter} onChange={(e) => setMatterFilter(e.target.value)} aria-label="Filter by matter">
          <option value="">All matters</option>
          {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_number} · {m.title}</option>)}
        </select>
      </PageHeader>

      <DataTable
        caption="Legal documents"
        columns={columns}
        rows={documents}
        rowKey={d => d.id}
        loading={loading}
        empty={
          <EmptyState
            icon={FileText}
            title={hasFilters ? 'No documents match those filters' : 'No documents yet'}
            description={hasFilters ? 'Clear the search, or pick a different type or matter.' : 'Upload the first document and attach it to a matter.'}
            action={!hasFilters && uploadButton}
          />
        }
      />

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload document"
        description="Every document must be attached to a matter."
        footer={
          <>
            <button className="btn btn-primary flex-1" onClick={upload} disabled={saving}>
              {saving ? 'Uploading…' : 'Upload'}
            </button>
            <button className="btn btn-ghost flex-1" onClick={() => setUploadOpen(false)}>Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">File *</label>
          <input type="file" className="input text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="label">Matter *</label>
          <select className="input text-sm" value={form.matter_id} onChange={(e) => setForm({ ...form, matter_id: e.target.value })}>
            <option value="">Select a matter…</option>
            {matters.map((m) => <option key={m.id} value={m.id}>{m.matter_number} · {m.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input text-sm capitalize" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DocumentType })}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Access level</label>
            <select className="input text-sm capitalize" value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value as FileAccessLevel })}>
              {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[var(--color-accent)]" checked={form.is_privileged} onChange={(e) => setForm({ ...form, is_privileged: e.target.checked })} />
          Covered by legal professional privilege
        </label>
      </Modal>
    </div>
  )
}
