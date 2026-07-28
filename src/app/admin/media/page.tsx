'use client'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, Trash2, Star, Loader2, Archive, Download, ArchiveRestore, Info, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

interface GalleryImage {
  id: string
  url: string
  caption?: string
  alt_text: string
  category: string
  is_featured: boolean
  created_at: string
}

interface UsageRecord {
  module: string
  id: string
  label: string
  href: string
}

const CATEGORIES = ['General', 'Office', 'Events', 'Team', 'Awards', 'Community', 'Other']

export default function AdminMediaLibraryPage() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [category, setCategory] = useState('All')
  const [uploadForm, setUploadForm] = useState({ caption: '', alt_text: '', category: 'General', is_featured: false })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [trash, setTrash] = useState(false)
  const selection = useSelection(images)

  const [detail, setDetail] = useState<GalleryImage | null>(null)
  const [usage, setUsage] = useState<UsageRecord[] | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const replaceFileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (category !== 'All') params.set('category', category)
    if (trash) params.set('trash', 'true')
    fetch(`/api/gallery?${params}`)
      .then(r => r.json())
      .then(d => setImages(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [category, trash])

  async function uploadImage() {
    if (!selectedFile) { toast.error('Select a file first'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('caption', uploadForm.caption)
      fd.append('alt_text', uploadForm.alt_text || uploadForm.caption)
      fd.append('category', uploadForm.category)
      fd.append('is_featured', String(uploadForm.is_featured))
      fd.append('tags', '[]')

      const res = await fetch('/api/gallery', { method: 'POST', body: fd })
      if (res.ok) {
        toast.success('Image uploaded!')
        setSelectedFile(null)
        setUploadForm({ caption: '', alt_text: '', category: 'General', is_featured: false })
        load()
      } else toast.error('Upload failed')
    } catch { toast.error('Upload error') }
    finally { setUploading(false) }
  }

  async function deleteImage(id: string) {
    if (!confirm('Move this image to trash?')) return
    const res = await fetch('/api/gallery', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast.success('Moved to trash'); load() }
    else toast.error('Delete failed')
  }

  async function restoreImage(id: string) {
    const res = await fetch(`/api/gallery/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: true }) })
    if (res.ok) { toast.success('Restored'); load() }
    else toast.error('Restore failed')
  }

  function openDetail(img: GalleryImage) {
    setDetail(img)
    setUsage(null)
    setUsageLoading(true)
    fetch(`/api/gallery/${img.id}/usage`)
      .then(r => r.json())
      .then(d => setUsage(d.usage || []))
      .finally(() => setUsageLoading(false))
  }

  async function replaceFile(id: string, file: File) {
    setReplacing(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/gallery/${id}/replace`, { method: 'POST', body: fd })
      if (res.ok) { toast.success('File replaced'); load() }
      else toast.error('Replace failed')
    } finally {
      setReplacing(false)
    }
  }

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const results = await Promise.all(ids.map(id =>
      action === 'delete'
        ? fetch('/api/gallery', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        : fetch(`/api/gallery/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: true }) })
    ))
    if (results.every(r => r.ok)) {
      toast.success(action === 'delete' ? 'Moved to trash' : 'Restored')
      selection.clear()
      load()
    } else {
      toast.error('Some items failed to update')
    }
  }

  function handleExport() {
    exportToCsv('gallery', images, [
      { header: 'Caption', accessor: (i) => i.caption ?? '' },
      { header: 'Category', accessor: (i) => i.category },
      { header: 'Featured', accessor: (i) => i.is_featured ? 'Yes' : 'No' },
      { header: 'URL', accessor: (i) => i.url },
      { header: 'Uploaded', accessor: (i) => i.created_at },
    ])
  }

  const allCategories = ['All', ...CATEGORIES]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Media Library</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{images.length} files {trash ? 'in trash' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Upload Form */}
      <div className="card p-5 mb-6">
        <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-[var(--color-accent)]" /> Upload New Image
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-1">
            <label className="label">File *</label>
            <div
              className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-4 text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-[var(--color-muted)]">{selectedFile ? selectedFile.name : 'Click to select'}</p>
            </div>
          </div>
          <div>
            <label className="label">Caption</label>
            <input className="input text-sm" value={uploadForm.caption} onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))} placeholder="Image caption" />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input text-sm" value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer mr-2">
              <input type="checkbox" checked={uploadForm.is_featured} onChange={e => setUploadForm(f => ({ ...f, is_featured: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">Featured</span>
            </label>
            <button onClick={uploadImage} disabled={uploading || !selectedFile} className="btn btn-primary gap-2 text-sm flex-1">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {allCategories.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === cat ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : images.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">No images yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map(img => (
            <div key={img.id} className="group relative rounded-lg overflow-hidden border border-[var(--color-border)] aspect-square">
              <Image src={img.url} alt={img.alt_text} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />

              <input
                type="checkbox"
                className="absolute top-2 right-2 z-10 w-4 h-4"
                checked={selection.selected.has(img.id)}
                onChange={() => selection.toggle(img.id)}
              />

              {img.is_featured && (
                <div className="absolute top-2 left-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button onClick={() => openDetail(img)} className="p-2 rounded-full bg-white/90 text-[var(--color-text-primary)] hover:bg-white transition-colors">
                  <Info className="w-4 h-4" />
                </button>
                {trash ? (
                  <button onClick={() => restoreImage(img.id)} className="p-2 rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 transition-colors">
                    <ArchiveRestore className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => deleteImage(img.id)} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{img.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-md shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] truncate">{detail.caption || detail.alt_text || 'Untitled'}</h3>
              <button onClick={() => setDetail(null)} className="btn btn-ghost p-1.5 !px-1.5 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>

            <div className="relative h-56 bg-[var(--color-surface-overlay)]">
              <Image src={detail.url} alt={detail.alt_text} fill className="object-contain" />
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="text-xs text-[var(--color-muted)]">
                Category: {detail.category} · Uploaded {new Date(detail.created_at).toLocaleDateString()}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">Used in</h4>
                {usageLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-muted)]" />
                ) : usage && usage.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {usage.map((u) => (
                      <li key={`${u.module}-${u.id}`} className="text-sm">
                        <a href={u.href} className="text-[var(--color-accent)] hover:underline">{u.label || 'Untitled'}</a>
                        <span className="text-[var(--color-muted)]">, {u.module}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--color-muted)]">Not currently used anywhere.</p>
                )}
              </div>

              <div>
                <input
                  ref={replaceFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && detail) replaceFile(detail.id, file)
                  }}
                />
                <button
                  onClick={() => replaceFileRef.current?.click()}
                  disabled={replacing}
                  className="btn btn-outline gap-2 text-sm w-full"
                >
                  {replacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Replace File
                </button>
                <p className="text-xs text-[var(--color-muted)] mt-1.5">Keeps the same file, anywhere it's already used updates automatically.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={
          trash
            ? [{ label: 'Restore', onClick: () => bulkAction('restore') }]
            : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]
        }
      />
    </div>
  )
}
