'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Mail, Phone, Scale, Receipt, FileText, Send, Eye, Calendar } from 'lucide-react'
import { formatDate, formatCurrency, getStatusColor, MATTER_TYPES } from '@/lib/utils'
import { stageMeta } from '@/lib/matterLifecycle'
import { INVOICE_STATUS_BADGE, invoiceStatusLabel } from '@/lib/invoiceLifecycle'
import toast from 'react-hot-toast'

interface Overview {
  profile: {
    id: string
    full_name: string
    email: string
    phone?: string
    role: string
    user_id: string | null
    is_active: boolean
    created_at: string
  }
  matters: { id: string; matter_number: string; title: string; type: string; status: string; opening_date: string }[]
  invoices: { id: string; matter_id: string; invoice_number: string; status: string; total: number; due_date: string | null; issued_at: string | null }[]
  submissions: { id: string; type: string; status: string; tracking_code: string; created_at: string }[]
  appointments: { id: string; matter_type: string; description: string | null; status: string; scheduled_date: string | null; scheduled_time: string | null; assigned_attorney?: { full_name: string } | null; created_at: string }[]
}

export default function PersonHubPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)

  function load() {
    fetch(`/api/people/${params.id}/overview`)
      .then(r => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [params.id])

  async function invite() {
    setInviting(true)
    try {
      const res = await fetch('/api/people/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: params.id }),
      })
      if (res.ok) toast.success('Sign-in link emailed to the client')
      else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not send the link')
      }
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!data) return <div className="text-center py-20 text-[var(--color-muted)]">Person not found.</div>

  const { profile } = data
  const matters = data.matters || []
  const invoices = data.invoices || []
  const submissions = data.submissions || []
  const appointments = data.appointments || []
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Who they are + where we stand */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-xl text-[var(--color-accent)]">{profile.full_name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{profile.full_name}</h1>
              <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] mt-1 flex-wrap">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                {profile.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{profile.phone}</span>}
                <span className="badge status-active text-xs capitalize">{profile.role}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile.user_id && <span className="badge status-active text-xs">Portal active</span>}
            <button onClick={invite} disabled={inviting} className="btn btn-outline gap-2 text-sm">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {profile.user_id ? 'Send New Sign-In Link' : 'Send Portal Access Link'}
            </button>
          </div>
        </div>

        {/* Standing summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[var(--color-border)] text-sm">
          <div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Matters</div>
            <div className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{matters.length}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Appointments</div>
            <div className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{appointments.length}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Enquiries</div>
            <div className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{submissions.length}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-0.5">Outstanding</div>
            <div className={`font-display text-lg font-semibold ${outstanding > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
              {formatCurrency(outstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* Matters */}
      <div className="card p-6 mb-6">
        <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <Scale className="w-4 h-4 text-[var(--color-accent)]" /> Matters
        </h2>
        {matters.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No matters yet. Matters appear here when a submission is promoted, or when this person is linked to one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {matters.map(m => (
              <Link key={m.id} href={`/admin/matters/${m.id}`}
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{m.matter_number}</span>
                    <span className={`badge ${getStatusColor(m.status)} text-xs`}>{stageMeta(m.status).label}</span>
                  </div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">{m.title}</div>
                  <div className="text-xs text-[var(--color-muted)]">{MATTER_TYPES.find(t => t.value === m.type)?.label || m.type} · Opened {formatDate(m.opening_date, 'short')}</div>
                </div>
                <Eye className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      {appointments.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-accent)]" /> Appointments
          </h2>
          <div className="flex flex-col gap-2">
            {appointments.map(a => (
              <Link key={a.id} href="/admin/appointments"
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.scheduled_date ? formatDate(a.scheduled_date, 'long') : 'Unscheduled'}{a.scheduled_time ? ` · ${a.scheduled_time.slice(0, 5)}` : ''}
                    </span>
                    <span className={`badge ${getStatusColor(a.status)} text-xs`}>{a.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {MATTER_TYPES.find(t => t.value === a.matter_type)?.label || a.matter_type}
                    {a.assigned_attorney?.full_name ? ` · ${a.assigned_attorney.full_name}` : ''}
                  </div>
                </div>
                <Eye className="w-4 h-4 text-[var(--color-muted)] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--color-accent)]" /> Invoices
          </h2>
          <div className="flex flex-col gap-2">
            {invoices.map(inv => (
              <Link key={inv.id} href={`/admin/matters/${inv.matter_id}`}
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{inv.invoice_number}</span>
                  <span className={`badge ${INVOICE_STATUS_BADGE[inv.status]} text-xs`}>{invoiceStatusLabel(inv.status)}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {inv.issued_at ? `Issued ${formatDate(inv.issued_at, 'short')}` : 'Draft'}
                    {inv.due_date && inv.status === 'sent' ? ` · Due ${formatDate(inv.due_date, 'short')}` : ''}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-shrink-0">{formatCurrency(Number(inv.total))}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Submissions */}
      {submissions.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-accent)]" /> Enquiries
          </h2>
          <div className="flex flex-col gap-2">
            {submissions.map(s => (
              <Link key={s.id} href={`/admin/submissions/${s.id}`}
                className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-raised)] transition-colors flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-[var(--color-accent)]">{s.tracking_code}</span>
                  <span className="text-sm text-[var(--color-text-primary)] capitalize">{s.type}</span>
                  <span className={`badge ${getStatusColor(s.status)} text-xs`}>{s.status.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-xs text-[var(--color-muted)] flex-shrink-0">{formatDate(s.created_at, 'short')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
