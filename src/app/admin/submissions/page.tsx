'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Eye, Loader2, RefreshCw, Trash2, ArchiveRestore, Download, Archive } from 'lucide-react'
import { formatDate, getStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useSelection } from '@/hooks/useSelection'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { exportToCsv } from '@/lib/csvExport'

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

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [trash, setTrash] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Submissions</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{total} {trash ? 'in trash' : 'total submissions'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTrash(!trash); setPage(1); selection.clear() }} className={`btn gap-2 text-sm ${trash ? 'btn-primary' : 'btn-outline'}`}>
            <Archive className="w-4 h-4" /> {trash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={handleExport} className="btn btn-outline gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={load} className="btn btn-ghost gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or code…"
            className="input pl-9 text-sm"
          />
        </div>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1) }} className="input w-40 text-sm">
          {TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input w-44 text-sm">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={selection.allSelected} onChange={selection.toggleAll} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">AI Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)] mx-auto" /></td></tr>
              ) : submissions.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-[var(--color-muted)]">No submissions found.</td></tr>
              ) : (
                submissions.map(sub => (
                  <tr key={sub.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selection.selected.has(sub.id)} onChange={() => selection.toggle(sub.id)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-accent)]">{sub.tracking_code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {!sub.first_opened_at && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] flex-shrink-0" title="Not yet opened" />
                        )}
                        <div className="font-medium text-[var(--color-text-primary)]">{sub.submitter_name}</div>
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">{sub.submitter_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-[var(--color-text-secondary)]">{sub.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(sub.status)} text-xs`}>{sub.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      {sub.ai_score !== undefined ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${sub.ai_score * 10}%` }} />
                          </div>
                          <span className="text-xs text-[var(--color-muted)]">{sub.ai_score}/10</span>
                        </div>
                      ) : <span className="text-xs text-[var(--color-muted)]">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{sub.assigned_member?.full_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{formatDate(sub.created_at, 'short')}</td>
                    <td className="px-4 py-3">
                      {trash ? (
                        <span title="Select and use Restore below" className="inline-flex p-1 opacity-30">
                          <ArchiveRestore className="w-4 h-4" />
                        </span>
                      ) : (
                        <Link href={`/admin/submissions/${sub.id}`} className="btn btn-ghost p-1 !px-1">
                          <Eye className="w-4 h-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between p-4 border-t border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-muted)]">Showing {((page-1)*20)+1}–{Math.min(page*20, total)} of {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn btn-ghost text-sm">Previous</button>
              <button disabled={page*20 >= total} onClick={() => setPage(p => p+1)} className="btn btn-ghost text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

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
