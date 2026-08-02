import { Check } from 'lucide-react'
import { MATTER_HAPPY_PATH, stageLabel as matterStageLabel } from '@/lib/matterLifecycle'
import { INTAKE_HAPPY_PATH, intakeStageMeta } from '@/lib/intakeLifecycle'

// ============================================================
// MATTER TIMELINE STRIP
// ============================================================
// Where this assignment sits in the matter's (or the enquiry's) life,
// read-only. Not the interactive stepper MatterPipeline/PipelineStepper
// render on their own pages, this is a smaller, non-clickable view so an
// assignee gets the context without gaining a second, cut-down way to act
// on stages they may not have permission to change.

export default function MatterTimelineStrip({ stageKey, isMatter }: { stageKey: string | null; isMatter: boolean }) {
  if (!stageKey) return <p className="text-xs text-[var(--color-muted)]">This assignment isn&apos;t tied to a specific stage.</p>

  const path: readonly string[] = isMatter ? MATTER_HAPPY_PATH : INTAKE_HAPPY_PATH
  const label = (s: string) => (isMatter ? matterStageLabel(s) : intakeStageMeta(s).label)
  const currentIdx = path.indexOf(stageKey)

  if (currentIdx === -1) {
    // An off-path terminal stage (declined/archived), just say so.
    return <p className="text-xs text-[var(--color-text-secondary)]">Currently at <span className="font-medium text-[var(--color-text-primary)]">{label(stageKey)}</span>.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {path.map((s, i) => {
        const done = i < currentIdx
        const current = i === currentIdx
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              done ? 'bg-[var(--color-accent)] text-white' : current ? 'border-2 border-[var(--color-accent)]' : 'bg-[var(--color-border)]'
            }`}>
              {done && <Check className="w-2.5 h-2.5" />}
            </div>
            <span className={`text-xs ${current ? 'text-[var(--color-accent)] font-semibold' : done ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-muted)]'}`}>
              {label(s)}{current ? ' ← Current' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
