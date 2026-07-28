'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatCurrency, formatMinutes } from '@/lib/utils'

interface Overview { mattersYtd: number; mattersActive: number; collectionRate: number; avgRealization: number; wipHours: number; wipValue: number }
interface Billing { totalBilled: number; collected: number; outstanding: number; overdue: number }
interface TypeRow { type: string; label: string; count: number }
interface PracticeAreaRow { type: string; label: string; matterCount: number; billed: number; collected: number; wipValue: number; realization: number }
interface AdvocateRow { id: string; name: string; matterCount: number; hoursLogged: number; billed: number; collected: number; realization: number }
interface AgeingBucket { label: string; count: number; total: number }
interface AgeingInvoice { id: string; invoice_number: string; client_name: string; due_date: string | null; daysOverdue: number; total: number }

interface Report {
  overview: Overview
  billing: Billing
  pipelineByType: TypeRow[]
  byPracticeArea: PracticeAreaRow[]
  byAdvocate: AdvocateRow[]
  ageing: { buckets: AgeingBucket[]; invoices: AgeingInvoice[] }
}

const TAB_LABEL: Record<string, string> = { overview: 'Overview', practice: 'By Practice Area', advocate: 'By Advocate', ageing: 'Ageing' }

function pct(n: number) {
  return `${Math.round(n)}%`
}
function hrs(hours: number) {
  return formatMinutes(Math.round(hours * 60))
}

export default function PerformancePage() {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'practice' | 'advocate' | 'ageing'>('overview')

  useEffect(() => {
    fetch('/api/reports/performance').then(r => r.ok ? r.json() : null).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
  if (!data) return <div className="text-center py-20 text-[var(--color-muted)]">Could not load the report.</div>

  const { overview, billing, pipelineByType, byPracticeArea, byAdvocate, ageing } = data
  const maxPipeline = Math.max(1, ...pipelineByType.map(t => t.count))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Performance</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Firm-wide snapshot, realization, collections, work in progress, and ageing receivables.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TAB_LABEL) as (keyof typeof TAB_LABEL)[]).map(k => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={`btn gap-2 text-sm ${tab === k ? 'btn-primary' : 'btn-outline'}`}>
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card p-5">
              <div className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{overview.mattersYtd}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">Matters (YTD)</div>
              <div className="text-xs text-[var(--color-muted)]">{overview.mattersActive} active</div>
            </div>
            <div className="card p-5">
              <div className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{pct(overview.collectionRate)}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">Collection Rate</div>
              <div className="text-xs text-[var(--color-muted)]">Paid vs billed</div>
            </div>
            <div className="card p-5">
              <div className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{pct(overview.avgRealization)}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">Avg Realization</div>
              <div className="text-xs text-[var(--color-muted)]">Hourly efficiency</div>
            </div>
            <div className="card p-5">
              <div className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">{hrs(overview.wipHours)}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">WIP (Unbilled)</div>
              <div className="text-xs text-[var(--color-muted)]">{formatCurrency(overview.wipValue)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Matter Pipeline by Practice Area</h2>
              {pipelineByType.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No active matters.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {pipelineByType.map(t => (
                    <div key={t.type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--color-text-secondary)]">{t.label}</span>
                        <span className="text-[var(--color-text-primary)] font-medium">{t.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-surface-overlay)] overflow-hidden">
                        <div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${(t.count / maxPipeline) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-display font-semibold text-[var(--color-text-primary)] mb-4">Billing Summary</h2>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Total billed</span><span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(billing.totalBilled)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Collected</span><span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(billing.collected)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Outstanding</span><span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(billing.outstanding)}</span></div>
                <div className="flex justify-between pt-3 border-t border-[var(--color-border)]"><span className="text-[var(--color-text-secondary)]">Overdue</span><span className="font-medium text-red-500">{formatCurrency(billing.overdue)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'practice' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)] uppercase tracking-wider">
                <th className="p-3">Practice Area</th>
                <th className="p-3">Matters</th>
                <th className="p-3">Billed</th>
                <th className="p-3">Collected</th>
                <th className="p-3">WIP</th>
                <th className="p-3">Realization</th>
              </tr>
            </thead>
            <tbody>
              {byPracticeArea.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-[var(--color-muted)]">No matters yet.</td></tr>
              ) : byPracticeArea.map(row => (
                <tr key={row.type} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="p-3 text-[var(--color-text-primary)]">{row.label}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{row.matterCount}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(row.billed)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(row.collected)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(row.wipValue)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{pct(row.realization)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'advocate' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)] uppercase tracking-wider">
                <th className="p-3">Advocate</th>
                <th className="p-3">Matters</th>
                <th className="p-3">Hours Logged</th>
                <th className="p-3">Billed</th>
                <th className="p-3">Collected</th>
                <th className="p-3">Realization</th>
              </tr>
            </thead>
            <tbody>
              {byAdvocate.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-[var(--color-muted)]">No assigned matters or logged time yet.</td></tr>
              ) : byAdvocate.map(row => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="p-3 text-[var(--color-text-primary)]">{row.name}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{row.matterCount}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{hrs(row.hoursLogged)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(row.billed)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(row.collected)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{pct(row.realization)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ageing' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {ageing.buckets.map(b => (
              <div key={b.label} className={`card p-4 ${b.label !== 'Current' && b.total > 0 ? 'border-l-[3px] border-l-red-500' : ''}`}>
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">{b.label}</div>
                <div className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{formatCurrency(b.total)}</div>
                <div className="text-xs text-[var(--color-muted)]">{b.count} invoice{b.count === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)] uppercase tracking-wider">
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Days Overdue</th>
                  <th className="p-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ageing.invoices.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-[var(--color-muted)]">Nothing overdue.</td></tr>
                ) : ageing.invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="p-3 text-[var(--color-text-primary)]">{inv.invoice_number}</td>
                    <td className="p-3 text-[var(--color-text-secondary)]">{inv.client_name}</td>
                    <td className="p-3 text-[var(--color-text-secondary)]">{inv.due_date}</td>
                    <td className="p-3 text-red-500 font-medium">{inv.daysOverdue}d</td>
                    <td className="p-3 text-[var(--color-text-secondary)]">{formatCurrency(inv.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
