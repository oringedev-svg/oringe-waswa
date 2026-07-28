'use client'
import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Archive, Download, ArchiveRestore, FileText, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

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
const ACCESS_LEVELS = ['public', 'client', 'staff']

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [trash, setTrash] = useState(false)
  const [editing, setEditing] = useState<Partial<Resource> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const selection = useSelection(resources)

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
      const res = isNew
        ? await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (res.ok) { toast.success(isNew ? 'Resource added' : 'Saved'); setEditing(null); setUploadFile(null); load() }
      else toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteResource(id: string) {
    if (!confirm('Move this resource to trash?')) return
    const res = await fetch(`/api/resources?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Client Resources</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{resources.length} resources {trash ? 'in trash' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => { setEditing({ category: 'General', access_level: 'public' }); setIsNew(true); setUploadFile(null) }} className="btn btn-primary gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Resource
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : resources.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No resources yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                <th className="px-4 py-3 w-8"><input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} /></th>
                {['Title', 'Category', 'Access', 'Downloads', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3"><input type="checkbox" checked={selection.selected.has(r.id)} onChange={() => selection.toggle(r.id)} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[var(--color-muted)] flex-shrink-0" />
                      <span className="font-medium text-[var(--color-text-primary)]">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{r.category}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${r.access_level === 'public' ? 'status-active' : 'status-pending'}`}>{r.access_level}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{r.download_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {trash ? (
                        <button onClick={async () => { await fetch('/api/resources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, restore: true }) }); load() }}
                          className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-accent)] transition-colors"><ArchiveRestore className="w-4 h-4" /></button>
                      ) : (
                        <>
                          <button onClick={() => { setEditing(r); setIsNew(false); setUploadFile(null) }} className="p-1.5 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-muted)] transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => deleteResource(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={trash ? [{ label: 'Restore', onClick: () => bulkAction('restore') }] : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md p-6 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{isNew ? 'Add Resource' : 'Edit Resource'}</h2>
              <button onClick={() => setEditing(null)} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Title *</label>
                <input className="input text-sm" value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input text-sm" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="input text-sm" value={editing.category || 'General'} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Access Level</label>
                  <select className="input text-sm" value={editing.access_level || 'public'} onChange={e => setEditing({ ...editing, access_level: e.target.value as Resource['access_level'] })}>
                    {ACCESS_LEVELS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">File {isNew ? '*' : '(leave blank to keep current)'}</label>
                <input ref={fileRef} type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors">
                  <Upload className="w-4 h-4 text-[var(--color-muted)] mx-auto mb-1" />
                  <p className="text-xs text-[var(--color-muted)]">{uploadFile ? uploadFile.name : editing.file_url ? 'Replace current file' : 'Click to choose a file'}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={uploadAndSave} disabled={saving} className="btn btn-primary flex-1 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {uploading ? 'Uploading…' : isNew ? 'Add Resource' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
