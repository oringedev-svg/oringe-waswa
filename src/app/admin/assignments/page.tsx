'use client'
import { useEffect, useState } from 'react'
import { LayoutList, LayoutGrid, ClipboardList } from 'lucide-react'
import SectionCard from '@/components/admin/SectionCard'
import AssignmentCard from '@/components/assignments/AssignmentCard'
import { PageHeader, StatusPill, LoadingState } from '@/components/admin/ui'

interface Assignment {
  id: string
  matter_id: string
  status: string
  assigned_to: string
  assigned_by: string
  assigned_at: string
  submitted_at?: string
  due_date?: string | null
  matter?: { matter_number: string; title: string }
  assignee?: { profile: { full_name: string } }
  assigned_by_user?: { full_name: string }
}

export default function AssignmentsPage() {
  const [assignedToMe, setAssignedToMe] = useState<Assignment[]>([])
  const [createdByMe, setCreatedByMe] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [gridView, setGridView] = useState(false)

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const activeStatuses = encodeURIComponent('Assigned,Accepted,In Progress,Submitted')
        const [toMeRes, byMeRes] = await Promise.all([
          fetch(`/api/assignments?assigned_to=me&status=${activeStatuses}`),
          fetch('/api/assignments?created_by=me'),
        ])

        if (toMeRes.ok) {
          const data = await toMeRes.json()
          setAssignedToMe(data.assignments || [])
        }

        if (byMeRes.ok) {
          const data = await byMeRes.json()
          setCreatedByMe(data.assignments || [])
        }
      } catch (error) {
        console.error('Failed to load assignments:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAssignments()
  }, [])

  if (loading) return <LoadingState label="Loading assignments" />

  const gridClass = gridView ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'flex flex-col gap-2'

  // Was pasted verbatim into both SectionCards, so the two copies drove the
  // same piece of state from two places.
  const viewToggle = (
    <div className="flex gap-0.5 bg-[var(--color-surface-overlay)] rounded-[var(--radius-md)] p-0.5" role="group" aria-label="View">
      <button
        onClick={() => setGridView(false)}
        aria-pressed={!gridView}
        className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${!gridView ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
        title="List view"
      >
        <LayoutList className="w-4 h-4" />
      </button>
      <button
        onClick={() => setGridView(true)}
        aria-pressed={gridView}
        className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${gridView ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
        title="Grid view"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )

  const todayStr = new Date().toISOString().slice(0, 10)
  const overdueToMe = assignedToMe.filter(a => a.due_date && a.due_date < todayStr).length
  const awaitingReview = createdByMe.filter(a => a.status === 'Submitted').length

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        icon={ClipboardList}
        eyebrow="Assignments"
        title="Work in progress"
        description="Track assignments, review work, and make decisions."
        meta={[
          `${assignedToMe.length} assigned to me`,
          overdueToMe > 0 ? `${overdueToMe} overdue` : null,
          awaitingReview > 0 ? `${awaitingReview} awaiting my review` : null,
        ]}
      />

      <SectionCard
        title="Assigned to me"
        color={overdueToMe > 0 ? 'red' : 'blue'}
        defaultOpen={true}
        badge={<StatusPill tone={overdueToMe > 0 ? 'overdue' : 'neutral'}>{overdueToMe > 0 ? `${overdueToMe} overdue` : String(assignedToMe.length)}</StatusPill>}
        headerExtra={viewToggle}
      >
        {assignedToMe.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6">Nothing is assigned to you right now.</p>
        ) : (
          <div className={gridClass}>
            {assignedToMe.map(a => (
              <AssignmentCard
                key={a.id}
                id={a.id}
                status={a.status}
                matterNumber={a.matter?.matter_number}
                matterTitle={a.matter?.title}
                assignedTo={a.assignee?.profile?.full_name}
                // submitted_at was previously passed as `dueDate`. The card
                // marks a past dueDate as overdue, and a submission stamp is
                // always in the past, so every submitted assignment showed
                // as overdue. These are two different props for a reason.
                submittedAt={a.submitted_at}
                dueDate={a.due_date}
                isGridView={gridView}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Created by me"
        color="purple"
        defaultOpen={awaitingReview > 0}
        badge={<StatusPill tone={awaitingReview > 0 ? 'review' : 'neutral'}>{awaitingReview > 0 ? `${awaitingReview} to review` : String(createdByMe.length)}</StatusPill>}
        headerExtra={viewToggle}
      >
        {createdByMe.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6">You haven&apos;t handed out any work yet.</p>
        ) : (
          <div className={gridClass}>
            {createdByMe.map(a => (
              <AssignmentCard
                key={a.id}
                id={a.id}
                status={a.status}
                matterNumber={a.matter?.matter_number}
                matterTitle={a.matter?.title}
                assignedBy={a.assigned_by_user?.full_name}
                submittedAt={a.submitted_at}
                dueDate={a.due_date}
                isGridView={gridView}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
