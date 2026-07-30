'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Receipt, Eye, DollarSign, AlertCircle, CheckCircle2, FileX } from 'lucide-react'
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

// Money states. `sent` is `risk` rather than neutral: an issued invoice
// nobody has paid is the one row on this page that needs chasing.
const STATUS_TONE: Record<InvoiceRow['status'], Tone> = {
  draft: 'neutral',
  sent: 'risk',
  paid: 'safe',
  void: 'neutral',
}

// A single KPI card for the billing summary strip
function BillingChip({
  label, value, icon: Icon, large = false,
  warning = false, success = false, muted = false,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  large?: boolean
  warning?: boolean
  success?: boolean
  muted?: boolean
}) {
  const accent = warning ? 'var(--status-warning)'
    : success ? 'var(--status-success)'
    : muted ? 'var(--color-text-muted)'
    : 'var(--color-brand)'

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors"
      style={{
        background: warning
          ? 'color-mix(in srgb, var(--status-warning) 7%, var(--color-surface))'
          : success
          ? 'color-mix(in srgb, var(--status-success) 7%, var(--color-surface))'
          : 'var(--color-surface)',
        borderColor: warning
          ? 'color-mix(in srgb, var(--status-warning) 22%, transparent)'
          : success
          ? 'color-mix(in srgb, var(--status-success) 22%, transparent)'
          : 'var(--color-border)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <div
          className={`${large ? 'text-xl' : 'text-lg'} font-semibold tabular-nums leading-none truncate`}
          style={{ color: warning ? 'var(--status-warning)' : success ? 'var(--status-success)' : 'var(--color-text-primary)' }}
        >
          {value}
        </div>
        <div className="text-[0.7rem] text-[var(--color-text-muted)] mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// Clickable status filter chip for the count strip
function StatusChip({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-start px-3.5 py-3 rounded-xl border text-left transition-all"
      style={{
        background: active
          ? 'color-mix(in srgb, var(--color-brand) 8%, var(--color-surface))'
          : 'var(--color-surface)',
        borderColor: active
          ? 'color-mix(in srgb, var(--color-brand) 35%, transparent)'
          : 'var(--color-border)',
        opacity: count === 0 ? 0.45 : 1,
      }}
    >
      <span
        className="text-2xl font-semibold tabular-nums leading-none mb-1"
        style={{ color: active ? 'var(--color-brand)' : 'var(--color-text-primary)' }}
      >
        {count}
      </span>
      <span className="text-[0.7rem] text-[var(--color-text-muted)]">{label}</span>
    </button>
  )
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

  // Billing KPIs
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + Number(i.total), 0)
  const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const draftsTotal = invoices.filter(i => i.status === 'draft').reduce((s, i) => s + Number(i.total), 0)

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
        meta={[
          `${total} invoice${total === 1 ? '' : 's'}`,
          outstanding > 0 ? `${formatCurrency(outstanding)} outstanding` : null,
        ]}
      />

      {/* Billing KPI strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <BillingChip
          icon={AlertCircle}
          label="Outstanding"
          value={formatCurrency(outstanding)}
          warning={outstanding > 0}
        />
        <BillingChip
          icon={CheckCircle2}
          label="Collected (this page)"
          value={formatCurrency(collected)}
          success={collected > 0}
        />
        <BillingChip
          icon={DollarSign}
          label="In draft"
          value={formatCurrency(draftsTotal)}
          muted
        />
      </div>

      {/* Status counts — click to filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {INVOICE_STATUSES.map(s => (
          <StatusChip
            key={s.key}
            label={s.label}
            count={counts[s.key] ?? 0}
            active={status === s.key}
            onClick={() => setStatus(status === s.key ? 'all' : s.key)}
          />
        ))}
      </div>

      <DataTable
        caption="Invoices"
        columns={columns}
        rows={invoices}
        rowKey={i => i.id}
        loading={loading}
        empty={
          <EmptyState
            icon={status === 'void' ? FileX : Receipt}
            title={status === 'all' ? 'No invoices yet' : `No ${invoiceStatusLabel(status as InvoiceRow['status'])} invoices`}
            description="Invoices are generated from unbilled time on a matter's page."
          />
        }
      />
    </div>
  )
}
