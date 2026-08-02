'use client'
import { actionsForStage, type WorkActionId, type WorkContext } from '@/lib/workContext'

// ============================================================
// STAGE ACTIONS
// ============================================================
// The contextual action bar. Which actions exist at a stage is data
// (STAGE_ACTIONS in workContext.ts); which of them this screen can actually
// perform is the `handlers` map. Only the intersection renders, so adding an
// action to the registry never produces a button that does nothing, and no
// screen needs a hardcoded per-stage list of its own.
//
// Every action inherits the WorkContext, so a handler is called knowing the
// matter, stage, client and enquiry without asking for any of them.

export default function StageActions({
  stageKey, context, permissions, handlers, className = '',
}: {
  stageKey: string | null | undefined
  context: WorkContext
  permissions: string[]
  /** What this screen knows how to do. Unhandled actions are not rendered. */
  handlers: Partial<Record<WorkActionId, () => void>>
  className?: string
}) {
  const actions = actionsForStage(stageKey, context, permissions).filter(a => handlers[a.id])

  if (actions.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {actions.map(action => {
        const Icon = action.icon
        return (
          <button
            key={action.id}
            onClick={handlers[action.id]}
            className="btn btn-ghost gap-1.5 text-sm"
          >
            <Icon className="w-4 h-4" /> {action.label}
          </button>
        )
      })}
    </div>
  )
}
