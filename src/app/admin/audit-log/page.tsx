'use client'
import { useEffect, useState, useCallback, Fragment } from 'react'
import { History, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, StatusPill, SearchInput, FilterTabs, type Tone } from '@/components/admin/ui'

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

// Was `bg-green-100 text-green-700` with no dark-mode variant, so in dark
// mode these pills rendered dark text on a near-white chip.
const ACTION_TONE: Record<AuditRow['action'], Tone> = {
  INSERT: 'safe',
  UPDATE: 'done',
  DELETE: 'overdue',
}

const TABLES = [
  'team_members', 'blog_posts', 'blog_comments', 'submissions', 'appointments',
  'legal_matters', 'legal_documents', 'profiles', 'gallery_images', 'certificates',
  'insights', 'coverage_areas', 'mail_subscribers', 'mail_campaigns', 'site_settings',
]

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

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(count / limit))

  return (
    <div>
      <PageHeader
        icon={History}
        eyebrow="System"
        title="Audit Log"
        description="Every create, update and delete performed in the admin, including by the AI assistant."
        meta={[`${count} entries`, table || null, action || null]}
      >
        <select
          className="input !w-auto text-sm"
          value={table}
          onChange={(e) => { setTable(e.target.value); setPage(1) }}
          aria-label="Filter by table"
        >
          <option value="">All tables</option>
          {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <FilterTabs
          value={action}
          onChange={(v) => { setAction(v); setPage(1) }}
          options={[
            { value: '', label: 'All' },
            { value: 'INSERT', label: 'Insert' },
            { value: 'UPDATE', label: 'Update' },
            { value: 'DELETE', label: 'Delete' },
          ]}
        />
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="bg-[var(--color-surface-overlay)] border-b border-[var(--color-border)]">
              <tr className="text-left">
                {['When', 'Table', 'Action', 'Record', ''].map(h => (
                  <th key={h} scope="col" className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--color-text-muted)]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--color-text-muted)]">No matching entries.</td></tr>
              ) : (
                rows.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-primary)]">{row.table_name}</td>
                      <td className="px-4 py-2.5"><StatusPill tone={ACTION_TONE[row.action]}>{row.action}</StatusPill></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{row.record_id?.slice(0, 8) || '-'}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                          aria-expanded={expanded === row.id}
                          className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          {expanded === row.id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {expanded === row.id && (
                      <tr className="bg-[var(--color-surface-overlay)]">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-xs overflow-x-auto max-h-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-[var(--color-text-secondary)]">
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
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-[var(--color-text-muted)]">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
