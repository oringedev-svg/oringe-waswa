'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt, Eye } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { INVOICE_STATUSES, invoiceStatusLabel, availableInvoiceTransitions } from '@/lib/invoiceLifecycle'
import toast from 'react-hot-toast'
import {
  PageHeader, DataTable, StatusPill, EmptyState, type Column, type Tone,
} from '@/components/admin/ui'

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

// Money states, in the same vocabulary the rest of the admin uses. `sent`
// is deliberately `risk` rather than neutral: an issued invoice nobody has
// paid is the one row on this page that needs chasing.
const STATUS_TONE: Record<InvoiceRow['status'], Tone> = {
  draft: 'neutral',
  sent: 'risk',
  paid: 'safe',
  void: 'neutral',
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

  const columns: Column<InvoiceRow>[] = [
    { label: 'Invoice No.', render: i => <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">{i.invoice_number}</span> },
    {
      label: 'Client / Matter',
      render: i => (
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-primary)] truncate">{i.client_name}</div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">{i.matter?.matter_number || '-'}</div>
        </div>
      ),
    },
    { label: 'Issued', secondary: true, render: i => i.issued_at ? formatDate(i.issued_at, 'short') : <span className="opacity-50">-</span> },
    { label: 'Due', secondary: true, render: i => i.due_date ? formatDate(i.due_date, 'short') : <span className="opacity-50">-</span> },
    {
      label: 'Total',
      className: 'text-right tabular-nums',
      render: i => <span className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(Number(i.total))}</span>,
    },
    { label: 'Status', render: i => <StatusPill tone={STATUS_TONE[i.status]} dot>{invoiceStatusLabel(i.status)}</StatusPill> },
    {
      label: '',
      className: 'text-right',
      render: i => (
        <div className="flex items-center gap-1.5 justify-end">
          {canBill && availableInvoiceTransitions(i.status).map(to => (
            <button
              key={to}
              onClick={() => transition(i.id, to)}
              className={`btn !py-1 !px-2.5 text-[0.68rem] ${to === 'void' ? 'btn-ghost text-[var(--status-danger)]' : 'btn-outline'}`}
            >
              {to === 'sent' ? 'Mark Sent' : to === 'paid' ? 'Mark Paid' : 'Void'}
            </button>
          ))}
          {i.matter_id && (
            <Link href={`/admin/matters/${i.matter_id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Open matter">
              <Eye className="w-4 h-4" />
            </Link>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Receipt}
        eyebrow="Money"
        title="Invoices"
        description="Generated from unbilled time on a matter's page."
        meta={[
          `${total} invoice${total === 1 ? '' : 's'}`,
          outstanding > 0 ? `${formatCurrency(outstanding)} outstanding on this page` : null,
        ]}
      />

      {/* Status counts double as the filter. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {INVOICE_STATUSES.map(s => {
          const active = status === s.key
          const count = counts[s.key] ?? 0
          return (
            <button
              key={s.key}
              onClick={() => setStatus(active ? 'all' : s.key)}
              aria-pressed={active}
              className={`card px-3 py-2.5 text-left transition-all border-l-[3px] ${active ? '' : 'border-l-transparent'} ${count === 0 ? 'opacity-50' : ''}`}
              style={active ? { borderLeftColor: 'var(--color-brand)' } : undefined}
            >
              <div className="font-display text-xl font-semibold text-[var(--color-text-primary)] tabular-nums leading-none">{count}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{s.label}</div>
            </button>
          )
        })}
      </div>

      <DataTable
        caption="Invoices"
        columns={columns}
        rows={invoices}
        rowKey={i => i.id}
        loading={loading}
        empty={
          <EmptyState
            icon={Receipt}
            title={status === 'all' ? 'No invoices yet' : `No ${invoiceStatusLabel(status as InvoiceRow['status'])} invoices`}
            description="Invoices are generated from unbilled time on a matter's page."
          />
        }
      />
    </div>
  )
}
