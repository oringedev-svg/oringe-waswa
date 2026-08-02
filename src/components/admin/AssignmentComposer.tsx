'use client'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/admin/ui/Modal'
import { assignmentPayloadFor, hasTarget, type WorkContext } from '@/lib/workContext'

// ============================================================
// ASSIGNMENT COMPOSER
// ============================================================
// The one way to hand out work. It replaces three separate implementations
// that all POSTed the same endpoint with different field sets: the matter
// lifecycle's "Assign Task" (preset + category cascade + due date), the
// intake stepper's "Assign this step" (person + comment), and the submission
// sidebar's "Assign To" (person + comment). Whatever the caller knows about
// where the user is arrives as a WorkContext and is inherited silently, so
// nothing that's already on screen has to be restated in the form.

export interface ComposerTeamMember {
  id: string
  full_name: string
  professional_type?: { id: string; name: string } | null
  /** Set by /available-assignees: false when the person is a client here. */
  is_eligible?: boolean
  ineligible_reason?: string | null
}

export default function AssignmentComposer({
  open, onClose, context, team: teamProp, suggestions = [], onCreated,
  title = 'Assign work', defaultInstructions = '',
}: {
  open: boolean
  onClose: () => void
  context: WorkContext
  /** Supply if the page already holds a team list; otherwise it's fetched. */
  team?: ComposerTeamMember[]
  /** Stage-appropriate task titles offered before free text. */
  suggestions?: string[]
  onCreated?: () => void
  title?: string
  /**
   * Pre-filled instruction text. The intake stepper files assignments under a
   * step by looking for the step's quoted label in the instructions, so it
   * seeds this to keep that grouping working; editing it is still allowed.
   */
  defaultInstructions?: string
}) {
  const [team, setTeam] = useState<ComposerTeamMember[]>(teamProp || [])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [category, setCategory] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [preset, setPreset] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (teamProp) setTeam(teamProp) }, [teamProp])

  // Only fetch when the caller didn't already have a list, so pages that do
  // aren't made to pay for a second round trip.
  useEffect(() => {
    if (!open || teamProp?.length) return
    setLoadingTeam(true)
    const qs = context.matterId ? `?matter_id=${context.matterId}` : ''
    fetch(`/api/assignments/available-assignees${qs}`)
      .then(r => (r.ok ? r.json() : { assignees: [] }))
      .then(d => setTeam(d.assignees || d.team || []))
      .catch(() => setTeam([]))
      .finally(() => setLoadingTeam(false))
  }, [open, teamProp, context.matterId])

  // A fresh dialog every time it opens; a half-filled previous attempt
  // reappearing under a different stage is worse than retyping.
  useEffect(() => {
    if (!open) return
    setCategory(''); setAssignedTo(''); setPreset('')
    setInstructions(defaultInstructions); setDueDate(''); setMessage('')
  }, [open, context.stageKey, defaultInstructions])

  // The API rejects assigning work to a client on the matter, so those
  // people are dropped here rather than offered and then refused.
  const eligible = useMemo(() => team.filter(t => t.is_eligible !== false), [team])

  const categories = useMemo(
    () => Array.from(new Set(eligible.map(t => t.professional_type?.name || 'Unclassified'))).sort(),
    [eligible],
  )
  const showCategories = categories.length > 1
  const visibleTeam = showCategories && category
    ? eligible.filter(t => (t.professional_type?.name || 'Unclassified') === category)
    : eligible

  async function submit() {
    if (!hasTarget(context)) { toast.error('Nothing to attach this assignment to'); return }
    if (!assignedTo) { toast.error('Choose who to assign this to'); return }
    const finalInstructions = (preset && preset !== '__other__' ? preset : instructions).trim()
    if (!finalInstructions) { toast.error('Say what needs to happen'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentPayloadFor(context, {
          assigned_to: assignedTo,
          instructions: finalInstructions,
          message,
          due_date: dueDate,
        })),
      })
      if (res.ok) {
        toast.success('Assigned, they will see this on their desk')
        onCreated?.()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Could not create the assignment')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  // What the assignment will inherit, shown rather than asked for. This is the
  // whole point of the context object, so it should be visible.
  const inherited = [
    context.matterNumber && `Matter ${context.matterNumber}`,
    context.matterTitle,
    context.clientName && `Client: ${context.clientName}`,
    context.stageLabel && `Stage: ${context.stageLabel}`,
  ].filter(Boolean) as string[]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={context.stageLabel ? `This will be linked to the ${context.stageLabel} stage.` : undefined}
      size="md"
      footer={
        <>
          <button onClick={submit} disabled={saving || loadingTeam} className="btn btn-primary gap-2 flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Assign
          </button>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        </>
      }
    >
      {inherited.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {inherited.map(chip => (
            <span key={chip} className="text-[0.7rem] px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)]">
              {chip}
            </span>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <label className="label">What needs doing</label>
          <select className="input text-sm" value={preset} onChange={e => { setPreset(e.target.value); if (e.target.value !== '__other__') setInstructions('') }}>
            <option value="">Choose a task…</option>
            {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__other__">Other (write it myself)…</option>
          </select>
        </div>
      )}

      {(preset === '__other__' || suggestions.length === 0) && (
        <div>
          {suggestions.length === 0 && <label className="label">What needs doing</label>}
          <textarea
            rows={3}
            className="input text-sm"
            placeholder={context.stageLabel ? `What needs to happen at ${context.stageLabel.toLowerCase()}?` : 'Describe the work…'}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {showCategories && (
          <div className="flex-1 min-w-[9rem]">
            <label className="label">Team</label>
            <select className="input text-sm" value={category} onChange={e => { setCategory(e.target.value); setAssignedTo('') }}>
              <option value="">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[10rem]">
          <label className="label">Assign to</label>
          <select className="input text-sm" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={loadingTeam}>
            <option value="">{loadingTeam ? 'Loading…' : 'Choose a person…'}</option>
            {visibleTeam.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="label">Due</label>
          <input type="date" className="input text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Note to the assignee <span className="text-[var(--color-text-muted)] font-normal">(optional)</span></label>
        <textarea
          rows={2}
          className="input text-sm"
          placeholder="Anything they should know before starting…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>
    </Modal>
  )
}
