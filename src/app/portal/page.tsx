'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Loader2, FileText, Download, LogOut, Scale, Phone, Receipt } from 'lucide-react'
import { formatDate, formatFileSize, formatCurrency, MATTER_TYPES } from '@/lib/utils'

interface PortalDocument {
  id: string
  title: string
  file_url: string
  file_name: string
  file_size: number
  created_at: string
}

interface PortalInvoice {
  id: string
  invoice_number: string
  status: 'sent' | 'paid'
  total: number
  due_date: string | null
  issued_at: string | null
}

interface PortalMatter {
  id: string
  matter_number: string
  title: string
  type: string
  stage: { label: string; description: string; tone: 'progress' | 'active' | 'paused' | 'done' }
  opening_date: string
  attorney?: { full_name: string; position: string } | null
  documents: PortalDocument[]
  invoices: PortalInvoice[]
}

const TONE_BADGE: Record<string, string> = {
  progress: 'status-review',
  active: 'status-active',
  paused: 'status-pending',
  done: 'status-completed',
}

export default function ClientPortalPage() {
  const router = useRouter()
  const [matters, setMatters] = useState<PortalMatter[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/matters').then(r => r.json()),
      fetch('/api/me').then(r => (r.ok ? r.json() : null)),
    ]).then(([res, me]) => {
      setMatters(res.data || [])
      setName(me?.fullName || '')
    }).finally(() => setLoading(false))
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-raised)' }}>
      {/* Portal header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="font-display font-semibold text-[var(--color-text-primary)]">Oringe Waswa & Akude Advocates LLP</span>
          </Link>
          <button onClick={handleSignOut} className="btn btn-ghost gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="container py-10">
        <div className="mb-8">
          <span className="eyebrow mb-2 block">Client Portal</span>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">
            {name ? `Welcome, ${name}` : 'Welcome'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Your matters with the firm, and documents shared with you.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
        ) : matters.length === 0 ? (
          <div className="card p-12 text-center">
            <Scale className="w-10 h-10 mx-auto mb-3 text-[var(--color-accent)]/30" />
            <p className="text-[var(--color-text-muted)] mb-4">No matters are linked to your account yet.</p>
            <Link href="/contact" className="btn btn-primary text-sm">Get in Touch</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {matters.map(matter => (
              <div key={matter.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
                  <div>
                    <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{matter.matter_number}</span>
                    <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mt-0.5">{matter.title}</h2>
                  </div>
                  <span className={`badge ${TONE_BADGE[matter.stage.tone]} flex-shrink-0`}>{matter.stage.label}</span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">{matter.stage.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-1">
                  <div>
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Matter Type</div>
                    <div className="text-[var(--color-text-primary)]">{MATTER_TYPES.find(m => m.value === matter.type)?.label || matter.type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Your Advocate</div>
                    <div className="text-[var(--color-text-primary)]">{matter.attorney?.full_name || 'Being assigned'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Opened</div>
                    <div className="text-[var(--color-text-primary)]">{formatDate(matter.opening_date, 'long')}</div>
                  </div>
                </div>

                {matter.invoices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">Invoices</div>
                    <div className="flex flex-col gap-2">
                      {matter.invoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)] flex-wrap">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Receipt className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                            <div>
                              <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{inv.invoice_number}</span>
                              <div className="text-xs text-[var(--color-muted)]">
                                {inv.issued_at && `Issued ${formatDate(inv.issued_at, 'short')}`}
                                {inv.due_date && inv.status === 'sent' && ` · Due ${formatDate(inv.due_date, 'short')}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(Number(inv.total))}</span>
                            <span className={`badge ${inv.status === 'paid' ? 'status-active' : 'status-pending'} text-xs`}>
                              {inv.status === 'paid' ? 'Paid' : 'Awaiting Payment'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matter.documents.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">Shared Documents</div>
                    <div className="flex flex-col gap-2">
                      {matter.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-overlay)]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.title}</div>
                              <div className="text-xs text-[var(--color-muted)]">{formatFileSize(doc.file_size)} · {formatDate(doc.created_at, 'short')}</div>
                            </div>
                          </div>
                          <a href={doc.file_url} download={doc.file_name} className="btn btn-ghost text-xs gap-1.5 flex-shrink-0">
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="card p-5 mt-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display font-semibold text-[var(--color-text-primary)]">Need to speak to us?</div>
            <p className="text-sm text-[var(--color-text-muted)]">Questions about your matter are best handled by your advocate directly.</p>
          </div>
          <Link href="/contact" className="btn btn-outline gap-2 text-sm flex-shrink-0">
            <Phone className="w-4 h-4" /> Contact the Firm
          </Link>
        </div>
      </main>
    </div>
  )
}
