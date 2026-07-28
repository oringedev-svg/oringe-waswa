'use client'
import { useEffect, useState, useCallback, Fragment } from 'react'
import { History, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditRow {
  id: string
  table_name: string
  record_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: unknown
  new_data: unknown
  performed_by: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [table, setTable] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const limit = 25

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (table) params.set('table', table)
    if (action) params.set('action', action)
    try {
      const res = await fetch(`/api/audit-log?${params.toString()}`)
      const data = await res.json()
      setRows(data.data || [])
      setCount(data.count || 0)
    } finally {
      setLoading(false)
    }
  }, [page, table, action])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(count / limit))

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <History className="w-6 h-6 text-[var(--color-accent)]" />
        <div>
          <h1 className="text-2xl font-display font-semibold text-[var(--color-text-primary)]">Audit Log</h1>
          <p className="text-sm text-[var(--color-muted)]">Every create, update, and delete performed in the admin, including by the AI assistant.</p>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--color-muted)]" />
        <select
          className="input !w-auto text-sm"
          value={table}
          onChange={(e) => { setTable(e.target.value); setPage(1) }}
        >
          <option value="">All tables</option>
          {['team_members','blog_posts','blog_comments','submissions','appointments','legal_matters','legal_documents','profiles','gallery_images','certificates','insights','coverage_areas','mail_subscribers','mail_campaigns','site_settings'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="input !w-auto text-sm"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
        >
          <option value="">All actions</option>
          <option value="INSERT">Insert</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>
        <span className="text-xs text-[var(--color-muted)] ml-auto">{count} total entries</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Table</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Record</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted)]">No matching entries.</td></tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-primary)]">{row.table_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[row.action]}`}>{row.action}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-muted)]">{row.record_id?.slice(0, 8) || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        className="text-xs text-[var(--color-accent)] hover:underline"
                      >
                        {expanded === row.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="bg-[var(--color-surface-raised)]">
                      <td colSpan={5} className="px-4 py-3">
                        <pre className="text-xs overflow-x-auto max-h-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-3">
{JSON.stringify({ old_data: row.old_data, new_data: row.new_data }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-[var(--color-muted)]">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
