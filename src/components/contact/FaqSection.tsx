'use client'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Faq {
  id: string
  question: string
  answer: string
  category?: string
}

export default function FaqSection() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/faqs')
      .then(r => r.json())
      .then(d => setFaqs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  if (faqs.length === 0) return null

  return (
    <div className="mt-14 reveal">
      <div className="text-center mb-8">
        <h2 className="font-display font-light" style={{ fontSize: 'var(--heading-section-size)' }}>Frequently Asked Questions</h2>
        <div className="grow-line rule-accent mx-auto mt-4" />
      </div>
      <div className="flex flex-col gap-2 max-w-2xl mx-auto">
        {faqs.map(faq => {
          const isOpen = open === faq.id
          return (
            <div key={faq.id} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : faq.id)}
                className="w-full flex items-center justify-between gap-4 p-4 text-left"
              >
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{faq.question}</span>
                <Plus className={cn('w-4 h-4 flex-shrink-0 text-[var(--color-accent)] transition-transform', isOpen && 'rotate-45')} />
              </button>
              <div className={cn('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
