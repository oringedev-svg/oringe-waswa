'use client'
import { useState, useEffect } from 'react'
import { Loader2, Plus, GripVertical, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

interface KanbanItem {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  due_date?: string
}

export default function PortalAssignmentsPage() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<KanbanItem[]>([])

  useEffect(() => {
    // Mocking assignments fetch since the table isn't specified
    setTimeout(() => {
      setTasks([
        { id: '1', title: 'Upload KYC Documents', description: 'Please upload your ID and utility bill.', status: 'todo', due_date: '2026-08-10' },
        { id: '2', title: 'Review Initial Draft', description: 'Review the contract draft in the documents section.', status: 'in_progress' },
        { id: '3', title: 'Sign Retainer', status: 'done' },
      ])
      setLoading(false)
    }, 800)
  }, [])

  const columns = [
    { id: 'todo', title: 'To Do', icon: AlertTriangle, color: 'text-amber-500' },
    { id: 'in_progress', title: 'In Progress', icon: Clock, color: 'text-sky-500' },
    { id: 'done', title: 'Completed', icon: CheckCircle2, color: 'text-emerald-500' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="mb-6 flex-shrink-0">
        <div className="font-mono text-[0.66rem] tracking-[0.14em] uppercase text-[var(--color-text-muted)] font-medium">
          Assignments
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          My Tasks
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Track tasks required by your advocate and review deliverables.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-6 h-full min-w-max pb-4">
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.status === col.id)
              const Icon = col.icon
              return (
                <div key={col.id} className="w-80 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                    <div className="flex items-center gap-2 font-medium text-[var(--color-text-primary)]">
                      <Icon className={`w-4 h-4 ${col.color}`} />
                      {col.title}
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-overlay)] px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="flex-1 bg-[var(--color-surface-overlay)]/30 rounded-xl p-3 flex flex-col gap-3 min-h-[200px] border border-[var(--color-border)]/50">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">No tasks</div>
                    ) : (
                      colTasks.map(task => (
                        <div key={task.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 shadow-xs cursor-move hover:border-[var(--color-accent)]/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <GripVertical className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing opacity-50" />
                            <div>
                              <h4 className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">{task.title}</h4>
                              {task.description && <p className="text-xs text-[var(--color-text-muted)] mt-1.5">{task.description}</p>}
                              {task.due_date && (
                                <div className="mt-3 inline-block">
                                  <span className="text-[0.65rem] px-2 py-1 rounded bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] font-medium flex items-center gap-1.5 border border-[var(--color-border)]">
                                    <Clock className="w-3 h-3" /> Due {task.due_date}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
