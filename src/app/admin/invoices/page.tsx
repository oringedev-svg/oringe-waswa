'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Receipt, Eye } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { INVOICE_STATUSES, INVOICE_STATUS_BADGE, invoiceStatusLabel, availableInvoiceTransitions } from '@/lib/invoiceLifecycle'
import toast from 'react-hot-toast'

interface InvoiceRow {
  id: string
  invoice_number: string
  client_name: string
  status: 'draft' | 'sent' | 'paid' | 'void'
  total: number
  due_date: string | null
  issued_at: string | null
  created_at: string
  matter_id: string | null
  matter?: { matter_number: string; title: string } | null
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [canBill, setCanBill] = useState(false)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (status !== 'all') params.set('status', status)
    Promise.all([
      fetch(`/api/invoices?${params}`).then(r => r.json()),
      fetch('/api/invoices?counts=statuses').then(r => r.json()),
      fetch('/api/me').then(r => (r.ok ? r.json() : null)),
    ]).then(([res, countsRes, me]) => {
      setInvoices(res.data || [])
      setTotal(res.count || 0)
      setCounts(countsRes && !countsRes.error ? countsRes : {})
      setCanBill(me?.role === 'admin' || (me?.permissions || []).includes('manage_billing'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  async function transition(id: string, to: string) {
    if (to === 'void' && !confirm('Void this invoice? Its time entries will return to unbilled.')) return
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to }),
    })
    if (res.ok) { toast.success(`Invoice marked ${to}`); load() }
    else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Could not update invoice')
    }
  }

  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Invoices</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {total} invoices{status === 'all' && outstanding > 0 ? ` · ${formatCurrency(outstanding)} outstanding on this page` : ''}
          </p>
        </div>
      </div>

      {/* Status counts */}
      <div className="flex flex-wrap gap-2 mb-6">
        {INVOICE_STATUSES.map(s => (
          <button
            key={s.key}
            onClick={() => setStatus(status === s.key ? 'all' : s.key)}
            className={`card px-4 py-2.5 text-left transition-all ${status === s.key ? 'border-[var(--color-accent)]' : ''}`}
          >
            <div className="text-lg font-display font-semibold text-[var(--color-text-primary)]">{counts[s.key] ?? 0}</div>
            <div className="text-xs text-[var(--color-muted)]">{s.label}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : invoices.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-muted)]">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No invoices yet. Invoices are generated from unbilled time on a matter&apos;s page.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                {['Invoice No.', 'Client / Matter', 'Issued', 'Due', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[var(--color-accent)] font-bold">{inv.invoice_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">{inv.client_name}</div>
                    <div className="text-xs text-[var(--color-muted)]">{inv.matter?.matter_number || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{inv.issued_at ? formatDate(inv.issued_at, 'short') : '-'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{inv.due_date ? formatDate(inv.due_date, 'short') : '-'}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{formatCurrency(Number(inv.total))}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${INVOICE_STATUS_BADGE[inv.status]} text-xs`}>{invoiceStatusLabel(inv.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canBill && availableInvoiceTransitions(inv.status).map(to => (
                        <button key={to} onClick={() => transition(inv.id, to)}
                          className={`btn text-xs ${to === 'void' ? 'btn-ghost text-red-500' : 'btn-outline'}`}>
                          {to === 'sent' ? 'Mark Sent' : to === 'paid' ? 'Mark Paid' : 'Void'}
                        </button>
                      ))}
                      {inv.matter_id && (
                        <Link href={`/admin/matters/${inv.matter_id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Open matter">
                          <Eye className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
