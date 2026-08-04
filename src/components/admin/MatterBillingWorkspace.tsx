'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import SectionCard from '@/components/admin/SectionCard'
import { LoadingState } from '@/components/admin/ui'
import { formatCurrency } from '@/lib/utils'

interface BillingSummary {
  estimated_work: number
  approved_work: number
  outstanding_work: number
  invoiced: number
  collected: number
  outstanding: number
  assignment_count: number
  invoice_count: number
}

interface MatterBillingWorkspaceProps {
  matterId: string
}

function BillingMetric({
  label,
  value,
  icon: Icon,
  color = 'blue',
}: {
  label: string
  value: string
  icon: React.ElementType
  color?: 'blue' | 'green' | 'amber' | 'red'
}) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
        <div className="font-semibold text-lg text-[var(--color-text-primary)]">{value}</div>
      </div>
    </div>
  )
}

export default function MatterBillingWorkspace({ matterId }: MatterBillingWorkspaceProps) {
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/matters/${matterId}/billing-summary`)
        if (!res.ok) {
          setError('Could not load billing summary')
        } else {
          const data = await res.json()
          setSummary(data)
        }
      } catch {
        setError('Could not load billing summary')
      } finally {
        setLoading(false)
      }
    }

    if (matterId) load()
  }, [matterId])

  if (loading) {
    return <LoadingState label="Loading billing workspace" />
  }

  if (error || !summary) {
    return (
      <SectionCard
        title="Billing Workspace"
        icon={DollarSign}
        color="gold"
        defaultOpen={false}
      >
        <p className="text-sm text-[var(--color-text-muted)]">{error || 'No billing data'}</p>
      </SectionCard>
    )
  }

  const completionPercent =
    summary.estimated_work > 0
      ? Math.round((summary.approved_work / summary.estimated_work) * 100)
      : 0

  const collectionPercent =
    summary.invoiced > 0 ? Math.round((summary.collected / summary.invoiced) * 100) : 0

  return (
    <SectionCard
      title="Billing Workspace"
      icon={DollarSign}
      color="gold"
      defaultOpen={false}
      badge={
        <div className="text-xs font-medium text-[var(--color-text-muted)]">
          {completionPercent}% approved
        </div>
      }
    >
      <div className="space-y-6">
        {/* Work Valuation Pipeline */}
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
            Work Valuation Pipeline
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <BillingMetric
              label="Estimated"
              value={formatCurrency(summary.estimated_work)}
              icon={TrendingUp}
              color="blue"
            />
            <BillingMetric
              label="Approved"
              value={formatCurrency(summary.approved_work)}
              icon={CheckCircle}
              color="green"
            />
            <BillingMetric
              label="Outstanding"
              value={formatCurrency(summary.outstanding_work)}
              icon={Clock}
              color="amber"
            />
            <BillingMetric
              label="Assignments"
              value={String(summary.assignment_count)}
              icon={DollarSign}
              color="blue"
            />
          </div>

          {/* Progress bar */}
          {summary.estimated_work > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-2">
                <span>Approval Progress</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Invoice Summary */}
        <div className="border-t border-[var(--color-border)] pt-4">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-3">
            Invoice Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <BillingMetric
              label="Invoiced"
              value={formatCurrency(summary.invoiced)}
              icon={DollarSign}
              color="blue"
            />
            <BillingMetric
              label="Collected"
              value={formatCurrency(summary.collected)}
              icon={CheckCircle}
              color="green"
            />
            <BillingMetric
              label="Outstanding"
              value={formatCurrency(summary.outstanding)}
              icon={Clock}
              color={summary.outstanding > 0 ? 'red' : 'green'}
            />
            <BillingMetric
              label="Invoices"
              value={String(summary.invoice_count)}
              icon={DollarSign}
              color="blue"
            />
          </div>

          {/* Collection bar */}
          {summary.invoiced > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-2">
                <span>Collection Rate</span>
                <span>{collectionPercent}%</span>
              </div>
              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${collectionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          <p>
            <strong>How it works:</strong> Estimated work is set when assignments are created. Approve work
            to move it to the finance queue. Invoices are created from approved work only.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
