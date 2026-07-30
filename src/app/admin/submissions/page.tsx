'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, RefreshCw, Download, Inbox } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import ViewToggle from '@/components/ViewToggle'
import { exportToCsv } from '@/lib/csvExport'
import {
  PageHeader, DataTable, StatusPill, EmptyState, LoadingState,
  SearchInput, FilterTabs, type Column, type Tone,
} from '@/components/admin/ui'

interface Submission {
  id: string
  tracking_code: string
  type: string
  status: string
  submitter_name: string
  submitter_email: string
  ai_score?: number
  created_at: string
  first_opened_at?: string | null
  assigned_member?: { full_name: string }
}

const TYPES = ['all', 'job', 'contact', 'paper', 'appointment']
const STATUSES = ['all', 'pending', 'under_review', 'accepted', 'rejected', 'completed', 'on_hold']

// Triage states. `pending` is `risk` because an untriaged enquiry is the
// thing this page exists to stop from sitting.
const STATUS_TONE: Record<string, Tone> = {
  pending: 'risk',
  under_review: 'review',
  accepted: 'safe',
  rejected: 'overdue',
  completed: 'done',
  on_hold: 'neutral',
}

function AiScore({ score }: { score?: number }) {
  if (score === undefined) return <span className="opacity-50">-</span>
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-14 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-xs text-[var(--color-text-muted)] tabular-nums">{score}/10</span>
    </div>
  )
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [trash, setTrash] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [gridView, setGridView] = useState(false)

  const selection = useSelection(submissions)

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (type !== 'all') params.set('type', type)
    if (status !== 'all') params.set('status', status)
    if (search.trim()) params.set('search', search.trim())
    if (trash) params.set('trash', 'true')
    fetch(`/api/submissions?${params}`)
      .then(r => r.json())
      .then(d => { setSubmissions(d.data || []); setTotal(d.count || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [type, status, page, trash])
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load() }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function bulkAction(action: 'delete' | 'restore') {
    const ids = Array.from(selection.selected)
    const res = await fetch('/api/submissions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    if (res.ok) {
      toast.success(action === 'delete' ? 'Moved to trash' : 'Restored')
      selection.clear()
      load()
    } else {
      toast.error('Bulk action failed')
    }
  }

  function handleExport() {
    exportToCsv('submissions', submissions, [
      { header: 'Tracking Code', accessor: (s) => s.tracking_code },
      { header: 'Name', accessor: (s) => s.submitter_name },
      { header: 'Email', accessor: (s) => s.submitter_email },
      { header: 'Type', accessor: (s) => s.type },
      { header: 'Status', accessor: (s) => s.status },
      { header: 'AI Score', accessor: (s) => s.ai_score ?? '' },
      { header: 'Assigned To', accessor: (s) => s.assigned_member?.full_name ?? '' },
      { header: 'Date', accessor: (s) => s.created_at },
    ])
  }

  const unopened = submissions.filter(s => !s.first_opened_at).length
  const hasFilters = Boolean(search || type !== 'all' || status !== 'all')

  const emptyState = (
    <EmptyState
      icon={Inbox}
      title={hasFilters ? 'No submissions match those filters' : trash ? 'Nothing in trash' : 'No submissions yet'}
      description={hasFilters ? 'Clear the search, or pick a different type or status.' : undefined}
    />
  )

  const columns: Column<Submission>[] = [
    {
      label: '',
      className: 'w-8',
      render: s => (
        <input
          type="checkbox"
          className="w-4 h-4 accent-[var(--color-accent)]"
          checked={selection.selected.has(s.id)}
          onChange={() => selection.toggle(s.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Select ${s.tracking_code}`}
        />
      ),
    },
    { label: 'Code', render: s => <span className="font-mono text-xs text-[var(--color-text-primary)]">{s.tracking_code}</span> },
    {
      label: 'Name',
      render: s => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {!s.first_opened_at && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--color-brand)]" title="Not yet opened" />
            )}
            <span className="font-medium text-[var(--color-text-primary)] truncate">{s.submitter_name}</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] truncate">{s.submitter_email}</div>
        </div>
      ),
    },
    { label: 'Type', secondary: true, className: 'capitalize', render: s => s.type },
    { label: 'Status', render: s => <StatusPill tone={STATUS_TONE[s.status] || 'neutral'}>{s.status.replace(/_/g, ' ')}</StatusPill> },
    { label: 'AI Score', secondary: true, render: s => <AiScore score={s.ai_score} /> },
    { label: 'Assigned To', secondary: true, render: s => s.assigned_member?.full_name || <span className="opacity-50">-</span> },
    { label: 'Date', secondary: true, render: s => formatDate(s.created_at, 'short') },
    {
      label: '',
      className: 'w-12 text-right',
      render: s => trash ? null : (
        <Link href={`/admin/submissions/${s.id}`} className="btn btn-ghost p-1.5 !px-1.5" title="Open submission">
          <Eye className="w-4 h-4" />
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={Inbox}
        eyebrow="New work"
        title="Submissions"
        description="Enquiries from the website, waiting to be triaged into matters."
        meta={[
          `${total} ${trash ? 'in trash' : 'total'}`,
          !trash && unopened > 0 ? `${unopened} not yet opened on this page` : null,
        ]}
        actions={
          <>
            <ViewToggle isGridView={gridView} onToggle={setGridView} />
            <button onClick={handleExport} className="btn btn-outline gap-2 text-sm" disabled={!submissions.length}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={load} className="btn btn-ghost gap-2 text-sm" title="Reload">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </>
        }
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, or code…" className="max-w-sm" />
        <select value={type} onChange={e => { setType(e.target.value); setPage(1) }} className="input w-40 text-sm">
          {TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input w-44 text-sm">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
        <FilterTabs
          value={trash ? 'trash' : 'live'}
          onChange={v => { setTrash(v === 'trash'); setPage(1); selection.clear() }}
          options={[{ value: 'live', label: 'Live' }, { value: 'trash', label: 'Trash' }]}
        />
      </PageHeader>

      {gridView ? (
        loading ? <LoadingState /> : submissions.length === 0 ? emptyState : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {submissions.map(sub => (
              <Link key={sub.id} href={`/admin/submissions/${sub.id}`} className="card p-4 h-full hover:shadow-[var(--shadow-md)] transition-shadow flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[var(--color-text-muted)] mb-1">{sub.tracking_code}</p>
                    <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2">{sub.submitter_name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{sub.submitter_email}</p>
                  </div>
                  {!sub.first_opened_at && (
                    <span className="w-2 h-2 rounded-full bg-[var(--color-brand)] flex-shrink-0 mt-1" title="Not yet opened" />
                  )}
                </div>
                <div className="flex-1" />
                <div className="pt-3 border-t border-[var(--color-border)] flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill>{sub.type}</StatusPill>
                    <StatusPill tone={STATUS_TONE[sub.status] || 'neutral'}>{sub.status.replace(/_/g, ' ')}</StatusPill>
                  </div>
                  <AiScore score={sub.ai_score} />
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(sub.created_at, 'short')}</p>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        <div className="mb-6">
          <DataTable
            caption="Submissions"
            columns={columns}
            rows={submissions}
            rowKey={s => s.id}
            loading={loading}
            empty={emptyState}
          />
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-[var(--color-text-muted)]">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40">Previous</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={
          trash
            ? [{ label: 'Restore', onClick: () => bulkAction('restore') }]
            : [{ label: 'Move to Trash', onClick: () => bulkAction('delete'), variant: 'danger' }]
        }
      />
    </div>
  )
}
