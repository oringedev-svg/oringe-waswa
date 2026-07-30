'use client'
import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Edit, Download, ArchiveRestore, FileText, Upload, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, Modal, DataTable, StatusPill, EmptyState, SearchInput, FilterTabs, type Column,
} from '@/components/admin/ui'

interface Resource {
  id: string
  title: string
  description?: string
  file_url: string
  file_type?: string
  category: string
  access_level: 'public' | 'client' | 'staff'
  download_count: number
}

const CATEGORIES = ['General', 'Guides', 'Forms', 'FAQs', 'Reports']
const ACCESS_LEVELS: Resource['access_level'][] = ['public', 'client', 'staff']

// Who can reach the file. `public` is the only one that leaves the firm, so
// it is the one the table needs to make obvious at a glance.
const ACCESS_TONE = {
  public: 'safe',
  client: 'done',
  staff: 'review',
} as const

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<Resource> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = resources.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
  })
  const selection = useSelection(filtered)

  function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (trash) params.set('trash', 'true')
    fetch(`/api/resources?${params}`)
      .then(r => r.json())
      .then(d => setResources(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [trash])

  async function uploadAndSave() {
    if (!editing?.title) { toast.error('Title is required'); return }
    if (isNew && !uploadFile) { toast.error('Choose a file to upload'); return }
    setSaving(true)
    try {
      let fileUrl = editing.file_url
      let fileType = editing.file_type

      if (uploadFile) {
        setUploading(true)
        const fd = new FormData()
        fd.append('file', uploadFile)
        fd.append('caption', editing.title)
        fd.append('alt_text', editing.title)
        fd.append('category', 'Resources')
        fd.append('is_featured', 'false')
        fd.append('tags', '[]')
        const uploadRes = await fetch('/api/gallery', { method: 'POST', body: fd })
        setUploading(false)
        if (!uploadRes.ok) { toast.error('File upload failed'); setSaving(false); return }
        const uploaded = await uploadRes.json()
        fileUrl = uploaded.url
        fileType = uploadFile.name.split('.').pop() || ''
      }

      const payload = { ...editing, file_url: fileUrl, file_type: fileType }
      const res = await fetch('/api/resources', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) { toast.success(isNew ? 'Resource added' : 'Saved'); setEditing(null); setUploadFile(null); load() }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function deleteResource(id: string) {
    if (!confirm('Move this resource to trash?')) return
    const res = await fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restore(id: string) {
    await fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    toast.success('Restored')
    load()
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
        : fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restore: true }) })
    ))
    if (results.every(r => r.ok)) { toast.success(action === 'delete' ? 'Moved to trash' : 'Restored'); selection.clear(); load() }
    else toast.error('Some items failed')
  }

  function handleExport() {
    exportToCsv('client-resources', resources, [
      { header: 'Title', accessor: (r) => r.title },
      { header: 'Category', accessor: (r) => r.category },
      { header: 'Access', accessor: (r) => r.access_level },
      { header: 'Downloads', accessor: (r) => r.download_count },
      { header: 'File URL', accessor: (r) => r.file_url },
    ])
  }

  const addButton = (
    <button onClick={() => { setEditing({ category: 'General', access_level: 'public' }); setIsNew(true); setUploadFile(null) }} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Add Resource
    </button>
  )

  const columns: Column<Resource>[] = [
    {
      label: '',
      className: 'w-8',
      render: r => (
        <input
          type="checkbox"
          className="w-4 h-4 accent-[var(--color-accent)]"
          checked={selection.selected.has(r.id)}
          onChange={() => selection.toggle(r.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${r.title}`}
        />
      ),
    },
    {
      label: 'Title',
      render: r => (
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
          <span className="font-medium text-[var(--color-text-primary)] truncate">{r.title}</span>
          {r.file_type && <span className="font-mono text-[0.6rem] uppercase text-[var(--color-text-muted)] flex-shrink-0">{r.file_type}</span>}
        </div>
      ),
    },
    { label: 'Category', secondary: true, render: r => r.category },
    { label: 'Access', render: r => <StatusPill tone={ACCESS_TONE[r.access_level]}>{r.access_level}</StatusPill> },
    { label: 'Downloads', secondary: true, className: 'tabular-nums', render: r => r.download_count },
    {
      label: 'Actions',
      className: 'w-24 text-right',
      render: r => (
        <div className="flex gap-1 justify-end">
          {trash ? (
            <button onClick={() => restore(r.id)} className="btn btn-ghost p-1.5 !px-1.5" title="Restore"><ArchiveRestore className="w-3.5 h-3.5" /></button>
          ) : (
            <>
              <button onClick={() => { setEditing(r); setIsNew(false); setUploadFile(null) }} className="btn btn-ghost p-1.5 !px-1.5" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => deleteResource(r.id)} className="btn btn-ghost p-1.5 !px-1.5 text-[var(--status-danger)]" title="Move to trash"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        eyebrow="Client portal"
        title="Client Resources"
        description="Guides, forms and reports clients can download. Access level controls who sees each one."
        meta={[`${filtered.length} ${trash ? 'in trash' : 'file' + (filtered.length === 1 ? '' : 's')}`]}
        actions={
          <>
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!resources.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            {!trash && addButton}
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search title or category…" />
        <FilterTabs
          value={trash ? 'trash' : 'live'}
          onChange={v => { setTrash(v === 'trash'); selection.clear() }}
          options={[{ value: 'live', label: 'Live' }, { value: 'trash', label: 'Trash' }]}
        />
      </PageHeader>

      <DataTable
        caption="Client resources"
        columns={columns}
        rows={filtered}
        rowKey={r => r.id}
        loading={loading}
        empty={
          <EmptyState
            icon={FolderOpen}
            title={search ? 'No resources match that search' : trash ? 'Nothing in trash' : 'No resources yet'}
            description={search ? 'Try a different word, or clear the search.' : undefined}
            action={!search && !trash && addButton}
          />
        }
      />

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={trash ? [{ label: 'Restore', onClick: () => bulkAction('restore') }] : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add Resource' : 'Edit Resource'}
        footer={
          <>
            <button onClick={uploadAndSave} disabled={saving} className="btn btn-primary flex-1">
              {uploading ? 'Uploading…' : saving ? 'Saving…' : isNew ? 'Add Resource' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Title *</label>
          <input className="input text-sm" value={editing?.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input text-sm" value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input text-sm" value={editing?.category || 'General'} onChange={e => setEditing({ ...editing, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Access Level</label>
            <select className="input text-sm" value={editing?.access_level || 'public'} onChange={e => setEditing({ ...editing, access_level: e.target.value as Resource['access_level'] })}>
              {ACCESS_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">File {isNew ? '*' : '(leave blank to keep current)'}</label>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-4 text-center cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-overlay)] transition-colors"
          >
            <Upload className="w-4 h-4 text-[var(--color-text-muted)] mx-auto mb-1.5" />
            <span className="block text-xs text-[var(--color-text-muted)]">
              {uploadFile ? uploadFile.name : editing?.file_url ? 'Replace current file' : 'Click to choose a file'}
            </span>
          </button>
        </div>
      </Modal>
    </div>
  )
}
