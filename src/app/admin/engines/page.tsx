import Link from 'next/link'
import { Cpu, Zap, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui'

export default function EnginesPage() {
  return (
    <div>
      <PageHeader
        icon={Cpu}
        eyebrow="Operations"
        title="Work Orchestration"
        description="Define activities, configure automation, and set up the engines that keep work flowing smoothly."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/activity-types"
          className="card p-6 hover:shadow-[var(--shadow-md)] transition-shadow group"
        >
          <Zap className="w-6 h-6 text-[var(--color-brand)] mb-3" />
          <h2 className="font-semibold text-lg text-[var(--color-text-primary)]">Activity Types</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Define workflow activities that can be assigned. Wire each to a Billing Reference to auto-populate work value.
          </p>
          <span className="inline-block text-sm font-medium text-[var(--color-brand)] mt-4 group-hover:underline">
            Manage activities →
          </span>
        </Link>

        <Link
          href="/admin/hubs"
          className="card p-6 hover:shadow-[var(--shadow-md)] transition-shadow group"
        >
          <BookOpen className="w-6 h-6 text-[var(--color-brand)] mb-3" />
          <h2 className="font-semibold text-lg text-[var(--color-text-primary)]">Reference Hubs</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Billing references, holidays, courts, and other firm-wide definitions that feed into workflow automation.
          </p>
          <span className="inline-block text-sm font-medium text-[var(--color-brand)] mt-4 group-hover:underline">
            View hubs →
          </span>
        </Link>
      </div>
    </div>
  )
}
