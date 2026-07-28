import PublicLayout from '@/components/layout/PublicLayout'
import Link from 'next/link'
import { ArrowRight, Scale } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase'
import ImpactTestimonials from '@/components/impact/ImpactTestimonials'

// Everything that proves the firm's work, gathered off the homepage so
// that page can stay a short introduction rather than a scroll through
// every kind of evidence at once: the full case record, client words, and
// the pro bono / CSR work that has no other home.
export const revalidate = 60

export const metadata = {
  title: 'Our Impact | Oringe Waswa & Akude Advocates LLP',
  description: 'Cases won, client experience, and the pro bono and community work of Oringe Waswa & Akude Advocates LLP.',
}

interface CaseResult {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  client_type?: string
  year?: number
}

interface Testimonial {
  id: string
  client_name: string
  client_role?: string
  quote: string
  avatar_url?: string
}

async function getImpactData() {
  const supabase = createAdminClient()

  // case_results may not exist on a deployment where migration 023 has not
  // been run; the page degrades to its other sections rather than erroring.
  let cases: CaseResult[] = []
  try {
    const { data, error } = await supabase
      .from('case_results')
      .select('*')
      .is('deleted_at', null)
      .order('year', { ascending: false })
      .order('display_order', { ascending: true })
    if (!error && data) cases = data as CaseResult[]
  } catch { /* table not created yet */ }

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  return {
    cases,
    testimonials: ((testimonials ?? []) as (Testimonial & { kind?: string })[])
      .filter(t => (t.kind ?? 'client') === 'client'),
  }
}

export default async function ImpactPage() {
  const { cases, testimonials } = await getImpactData()

  // Grouped by year so the record reads as a track record over time rather
  // than one long undifferentiated list.
  const byYear = cases.reduce<Record<string, CaseResult[]>>((acc, c) => {
    const key = c.year ? String(c.year) : 'Other'
    ;(acc[key] ||= []).push(c)
    return acc
  }, {})
  const years = Object.keys(byYear).sort((a, b) => {
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    return Number(b) - Number(a)
  })

  return (
    <PublicLayout>
      {/* Header */}
      <div className="relative py-24 overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <h1 className="font-display font-light mb-4 reveal" style={{ fontSize: 'var(--heading-page-size)' }}>
            Our Impact
          </h1>
          <p className="text-[var(--color-text-muted)] max-w-2xl reveal stagger-1">
            The outcomes we have secured, what clients say about working with us, and the
            work we do beyond the fee-paying file.
          </p>
        </div>
      </div>

      {/* Cases won */}
      <section className="section">
        <div className="container">
          <h2 className="font-display mb-2 reveal" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>
            Cases Won
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-12 reveal">
            A track record measured in outcomes, not years. Client details are withheld or
            anonymised throughout.
          </p>

          {cases.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No case results published yet.</p>
          ) : (
            years.map(year => (
              <div key={year} className="mb-12">
                <div className="impact-year-head reveal">
                  <span className="impact-year">{year}</span>
                  <span className="impact-year-rule" />
                  <span className="impact-year-count">
                    {byYear[year].length} {byYear[year].length === 1 ? 'matter' : 'matters'}
                  </span>
                </div>
                <div className="impact-case-grid">
                  {byYear[year].map((c, i) => (
                    <article key={c.id} className={`impact-case reveal stagger-${Math.min(i + 1, 5)}`}>
                      <Scale className="w-4 h-4 impact-case-icon" strokeWidth={1.5} />
                      <span className="impact-case-outcome">{c.outcome}</span>
                      <h3 className="impact-case-title">{c.title}</h3>
                      {c.summary && <p className="impact-case-summary">{c.summary}</p>}
                      <span className="impact-case-meta">
                        {[c.practice_area, c.client_type].filter(Boolean).join(' · ')}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Client words */}
      {testimonials.length > 0 && (
        <section className="section section-flush">
          <div className="container">
            <h2 className="font-display mb-12 reveal" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>
              What Clients Say
            </h2>
            <ImpactTestimonials testimonials={testimonials} />
          </div>
        </section>
      )}

      {/* Pro bono and CSR. Static, honest copy: the firm has not published
          programme figures, so none are invented here. Each block is a
          statement of commitment, not a claimed statistic. */}
      <section className="section">
        <div className="container">
          <h2 className="font-display mb-2 reveal" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>
            Beyond the Billable File
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm mb-12 reveal max-w-2xl">
            Access to justice does not track ability to pay. These are the commitments the
            firm holds itself to outside paid instructions.
          </p>

          <div className="impact-commitments">
            <article className="impact-commitment reveal">
              <h3>Pro Bono Representation</h3>
              <p>
                We take on matters where the need is real and the means are not there,
                particularly in succession, family and land disputes affecting households
                who would otherwise go unrepresented.
              </p>
            </article>
            <article className="impact-commitment reveal stagger-1">
              <h3>Legal Literacy</h3>
              <p>
                Plain-language guidance on the questions people actually arrive with:
                what a demand letter means, how succession works, what to do when served.
                Published openly rather than held behind a consultation.
              </p>
            </article>
            <article className="impact-commitment reveal stagger-2">
              <h3>Pupillage &amp; Mentorship</h3>
              <p>
                Our pupillage programme takes entrants through real files under a
                supervising advocate, because the profession is only as good as the
                people entering it.
              </p>
            </article>
            <article className="impact-commitment reveal stagger-3">
              <h3>Community Engagement</h3>
              <p>
                Working with local organisations on the legal questions their members
                bring, from land and tenancy to employment rights.
              </p>
            </article>
          </div>

          <div className="mt-12 reveal">
            <Link href="/contact" className="btn btn-outline gap-2">
              Discuss a pro bono matter <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
