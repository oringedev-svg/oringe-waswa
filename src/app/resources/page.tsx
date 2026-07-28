'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2, FileText, Download } from 'lucide-react'

interface Resource {
  id: string
  title: string
  description?: string
  file_url: string
  file_type?: string
  category: string
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')

  useEffect(() => {
    fetch('/api/resources')
      .then(r => r.json())
      .then(d => setResources(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const categories = ['All', ...Array.from(new Set(resources.map(r => r.category)))]
  const filtered = category === 'All' ? resources : resources.filter(r => r.category === category)

  async function handleDownload(resource: Resource) {
    fetch(`/api/resources/${resource.id}/download`, { method: 'POST' }).catch(() => {})
    window.open(resource.file_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <PublicLayout>
      <div className="container py-16 md:py-24">
        <div className="max-w-2xl mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--color-text-primary)] mb-4">Client Resources</h1>
          <p className="text-[var(--color-text-muted)]">Guides, forms, and reports available for download.</p>
        </div>

        {categories.length > 2 && (
          <div className="flex gap-2 mb-10 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  category === c ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-muted)]">No resources available right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(resource => (
              <div key={resource.id} className="card p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-sm bg-[var(--color-surface-overlay)] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-1">{resource.title}</h3>
                  {resource.description && <p className="text-sm text-[var(--color-text-secondary)] mb-3">{resource.description}</p>}
                  <button onClick={() => handleDownload(resource)} className="btn btn-outline text-sm gap-2">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
