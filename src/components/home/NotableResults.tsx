import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface CaseResult {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  client_type?: string
  year?: number
  image_url?: string
}

// ALN's services-slider card pattern: a full-bleed image card carrying a
// large index number and the outcome, with the summary held back until
// hover behind a solid ink wash. The row is pulled up over the video band
// above it, so the cards straddle the two sections rather than starting a
// visually separate block. No client-side fetch, results arrive
// server-fetched from the homepage.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=80',
]

export default function NotableResults({ initialResults }: { initialResults: CaseResult[] }) {
  const results = initialResults.slice(0, 3)

  if (results.length === 0) return null

  return (
    <section className="section case-results-section">
      <div className="container">
        <div className="case-results-grid">
          {results.map((r, i) => (
            <Link key={r.id} href="/impact" className={`case-card reveal stagger-${Math.min(i + 1, 5)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="case-card-media"
                src={r.image_url || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length]}
                alt=""
              />
              <span className="case-card-wash" />
              <span className="case-card-index">{String(i + 1).padStart(2, '0')}</span>

              <span className="case-card-arrow"><ArrowUpRight className="w-4 h-4" /></span>

              <div className="case-card-body">
                <span className="case-card-outcome">{r.outcome}</span>
                <span className="case-card-title">{r.title}</span>
                <div className="case-card-detail">
                  <div className="case-card-detail-inner">
                    {r.summary && <p className="case-card-summary">{r.summary}</p>}
                    <span className="case-card-meta">
                      {[r.practice_area, r.client_type, r.year].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12 reveal">
          <Link href="/impact" className="btn btn-outline">See Our Full Impact</Link>
        </div>
      </div>
    </section>
  )
}
