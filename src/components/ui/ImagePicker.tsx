'use client'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Upload, Search, Loader2, Check, X, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

interface GalleryImage {
  id: string
  url: string
  caption?: string
  alt_text: string
  category: string
}

interface ImagePickerProps {
  value?: string
  onChange: (url: string) => void
  bucket?: string
  label?: string
  placeholder?: string
}

export default function ImagePicker({ value, onChange, label = 'Image', placeholder = 'Select or paste URL' }: ImagePickerProps) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'gallery' | 'url' | 'upload'>('gallery')
  const [urlInput, setUrlInput] = useState(value || '')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) loadImages()
  }, [open])

  async function loadImages() {
    setLoading(true)
    try {
      const res = await fetch('/api/gallery?limit=100')
      const data = await res.json()
      setImages(data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const filtered = search
    ? images.filter(i =>
        i.caption?.toLowerCase().includes(search.toLowerCase()) ||
        i.alt_text?.toLowerCase().includes(search.toLowerCase()) ||
        i.category?.toLowerCase().includes(search.toLowerCase())
      )
    : images

  function select(url: string) {
    onChange(url)
    setOpen(false)
  }

  async function doUpload() {
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('caption', uploadFile.name.replace(/\.[^.]+$/, ''))
      fd.append('alt_text', uploadFile.name.replace(/\.[^.]+$/, ''))
      fd.append('category', 'General')
      fd.append('is_featured', 'false')
      fd.append('tags', '[]')

      const res = await fetch('/api/gallery', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        toast.success('Uploaded')
        setUploadFile(null)
        select(data.url)
      } else {
        toast.error('Upload failed')
      }
    } catch {
      toast.error('Upload error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {label && <label className="label">{label}</label>}

      {/* Preview & trigger */}
      <div
        className="relative border border-[var(--color-border)] rounded-lg overflow-hidden cursor-pointer hover:border-[var(--color-accent)] transition-colors group"
        onClick={() => setOpen(true)}
      >
        {value ? (
          <div className="relative h-32">
            <Image src={value} alt="Selected" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full">Change</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="h-24 flex flex-col items-center justify-center gap-2 bg-[var(--color-surface-overlay)]">
            <ImageIcon className="w-6 h-6 text-[var(--color-muted)]" />
            <span className="text-xs text-[var(--color-muted)]">{placeholder}</span>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-[var(--shadow-xl)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Select Image</h3>
              <button onClick={() => setOpen(false)} className="btn btn-ghost p-1.5 !px-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--color-border)]">
              <button
                onClick={() => setTab('gallery')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'gallery' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-muted)]'}`}
              >
                Gallery ({images.length})
              </button>
              <button
                onClick={() => setTab('url')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'url' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-muted)]'}`}
              >
                Paste URL
              </button>
              <button
                onClick={() => setTab('upload')}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'upload' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-muted)]'}`}
              >
                Upload New
              </button>
            </div>

            {tab === 'gallery' && (
              <>
                {/* Search */}
                <div className="p-3 border-b border-[var(--color-border)]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search images…"
                      className="input pl-9 text-sm"
                    />
                  </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-12">
                      <ImageIcon className="w-10 h-10 text-[var(--color-muted)]/30 mx-auto mb-2" />
                      <p className="text-sm text-[var(--color-muted)]">
                        {images.length === 0 ? 'No media yet, try the Upload New tab.' : 'No images match your search.'}
                      </p>
                    </div>
                  ) : (
                    <div className="image-picker-grid">
                      {filtered.map(img => (
                        <div
                          key={img.id}
                          className={`image-picker-item ${value === img.url ? 'selected' : ''}`}
                          onClick={() => select(img.url)}
                          title={img.caption || img.alt_text}
                        >
                          <Image src={img.url} alt={img.alt_text} fill className="object-cover" sizes="100px" />
                          {value === img.url && (
                            <div className="absolute inset-0 bg-[var(--color-accent)]/30 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'url' && (
              <div className="p-4 flex flex-col gap-3">
                <label className="label">Image URL</label>
                <input
                  type="url"
                  className="input"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                {urlInput && (
                  <div className="relative h-40 rounded-lg overflow-hidden bg-[var(--color-surface-overlay)]">
                    <Image src={urlInput} alt="Preview" fill className="object-cover" onError={() => {}} />
                  </div>
                )}
                <button
                  onClick={() => { if (urlInput) select(urlInput) }}
                  disabled={!urlInput}
                  className="btn btn-primary"
                >
                  Use This Image
                </button>
              </div>
            )}

            {tab === 'upload' && (
              <div className="p-4 flex flex-col gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border border-dashed border-[var(--color-border)] rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                >
                  <Upload className="w-6 h-6 text-[var(--color-muted)]" />
                  <span className="text-sm text-[var(--color-muted)]">{uploadFile ? uploadFile.name : 'Click to choose an image file'}</span>
                </div>
                {uploadFile && (
                  <div className="relative h-40 rounded-lg overflow-hidden bg-[var(--color-surface-overlay)]">
                    <Image src={URL.createObjectURL(uploadFile)} alt="Preview" fill className="object-cover" />
                  </div>
                )}
                <button
                  onClick={doUpload}
                  disabled={!uploadFile || uploading}
                  className="btn btn-primary gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload and Use
                </button>
                <p className="text-xs text-[var(--color-muted)]">Uploaded files are added to the shared media library.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
