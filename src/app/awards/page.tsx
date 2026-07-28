'use client'
import { useEffect, useState } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Award {
  id: string
  title: string
  issuer?: string
  year?: number
  description?: string
  image_url?: string
  is_featured: boolean
}

export default function AwardsPage() {
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/awards')
      .then(r => r.json())
      .then(d => setAwards(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout>
      <div className="container py-16 md:py-24">
        <div className="max-w-2xl mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--color-text-primary)] mb-4">Awards and Recognition</h1>
          <p className="text-[var(--color-text-muted)]">Recognition for our work across the region.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
        ) : awards.length === 0 ? (
          <p className="text-[var(--color-muted)]">No awards to show yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {awards.map(award => (
              <div key={award.id} className="card p-6">
                {award.image_url ? (
                  <div className="relative h-32 mb-4 rounded-lg overflow-hidden bg-[var(--color-surface-overlay)]">
                    <Image src={award.image_url} alt={award.title} fill className="object-contain" />
                  </div>
                ) : (
                  <div className="h-32 mb-4 rounded-lg flex items-center justify-center bg-[var(--color-surface-overlay)]">
                    <span className="font-display text-3xl text-[var(--color-accent)]">{award.title.charAt(0)}</span>
                  </div>
                )}
                <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-1">{award.title}</h3>
                <p className="text-sm text-[var(--color-muted)] mb-2">{award.issuer}{award.year ? ` · ${award.year}` : ''}</p>
                {award.description && <p className="text-sm text-[var(--color-text-secondary)]">{award.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
