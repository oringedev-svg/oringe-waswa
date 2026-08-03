import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateGates, gatesSatisfied, STAGE_GATES, type GateFacts } from '@/lib/workContext'
import { nextHappyStage, type MatterStage } from '@/lib/matterLifecycle'
import { nextHappyIntakeStage, type IntakeStage } from '@/lib/intakeLifecycle'
import { logAudit } from '@/lib/audit'

// ============================================================
// WORKFLOW COMPLETION ENGINE
// ============================================================
// Approving an assignment used to write to legal_matters.current_stage_id
// and stamp matter_stage_history with pipeline_stages UUIDs. Nothing else in
// the app reads current_stage_id (the real lifecycle driver is
// legal_matters.status, a MatterStage string), and matter_stage_history is
// read everywhere else as string keys, not UUIDs, so that write was
// silently inert: the matter's actual status column never moved and the
// stage history it wrote was unreadable by every other screen. Compounding
// it, pipeline_stages itself has never had a row seeded for this firm, so
// the auto_advance/next_stage_id config it depended on could not have had
// data even if the write target had been correct.
//
// This module is the replacement: it runs directly against the string-keyed
// MatterStage/IntakeStage enums that legal_matters.status,
// submissions.intake_stage, and every UI stepper already use, and against
// the STAGE_GATES declared in workContext.ts rather than a pipeline_stages
// row nothing populates.

export interface AdvanceResult {
  advanced: boolean
  from?: string
  to?: string
  reason?: 'stale' | 'gates_unmet' | 'end_of_path'
  unmetGates?: string[]
}

async function markAssignmentCompletionGates(
  supabase: SupabaseClient,
  args: { matterId: string | null; submissionId: string | null; stageKey: string; assignmentId: string; actorId: string },
) {
  const gates = STAGE_GATES[args.stageKey] || []
  const toRecord = gates.filter(g => g.source === 'assignment_completion')
  if (toRecord.length === 0) return

  await supabase.from('stage_completions').upsert(
    toRecord.map(g => ({
      matter_id: args.matterId,
      submission_id: args.submissionId,
      stage_key: args.stageKey,
      gate_id: g.id,
      source: 'assignment_completion' as const,
      satisfied_by: args.actorId,
      assignment_id: args.assignmentId,
    })),
    { onConflict: 'matter_id,submission_id,stage_key,gate_id', ignoreDuplicates: true },
  )
}

async function computeGateFacts(
  supabase: SupabaseClient,
  args: { matterId: string | null; submissionId: string | null; stageKey: string },
): Promise<GateFacts> {
  const gates = STAGE_GATES[args.stageKey] || []
  if (gates.length === 0) return {}

  const facts: GateFacts = {}

  // 'live' gates: computed fresh from conflict_checks every time, the same
  // table the conflict-check panel itself reads.
  if (gates.some(g => g.source === 'live')) {
    let query = supabase.from('conflict_checks').select('decision, practice_area_ids')
    query = args.matterId ? query.eq('matter_id', args.matterId) : query.eq('submission_id', args.submissionId!)
    const { data: checks } = await query
    facts.conflict_search_run = (checks?.length ?? 0) > 0
    if (args.matterId) {
      const { data: links } = await supabase.from('matter_practice_areas').select('practice_area_id').eq('matter_id', args.matterId)
      const requiredAreas = new Set((links || []).map(link => link.practice_area_id))
      // A later-added area invalidates the earlier clearance until a check
      // explicitly covering the complete current set is decided.
      facts.conflict_decision_recorded = requiredAreas.size > 0 && (checks || []).some(check => {
        const covered = new Set(check.practice_area_ids || [])
        return check.decision !== 'pending' && [...requiredAreas].every(id => covered.has(id))
      })
    } else {
      facts.conflict_decision_recorded = (checks || []).some(c => c.decision !== 'pending')
    }
  }

  // 'assignment_completion' gates: read back whatever's been recorded.
  if (gates.some(g => g.source === 'assignment_completion')) {
    let query = supabase.from('stage_completions').select('gate_id').eq('stage_key', args.stageKey)
    query = args.matterId ? query.eq('matter_id', args.matterId) : query.eq('submission_id', args.submissionId!)
    const { data: completions } = await query
    const satisfied = new Set((completions || []).map(c => c.gate_id))
    for (const g of gates) {
      if (g.source === 'assignment_completion') facts[g.id as keyof GateFacts] = satisfied.has(g.id)
    }
  }

  return facts
}

/**
 * Called when an assignment tied to a matter stage is approved. Records
 * which gates that completion satisfies, then advances the matter to the
 * next happy-path stage if (and only if) every gate for the current stage
 * is now met. A stage with no gates declared advances on the assignment's
 * approval alone, there being nothing else to check.
 *
 * No-ops (reason: 'stale') if the matter has already moved past this stage
 * by some other path, so an old assignment being approved late can never
 * push the matter backwards.
 */
export async function evaluateAndAdvanceMatterStage(
  supabase: SupabaseClient,
  args: { matterId: string; stageKey: string; assignmentId: string; actorId: string },
): Promise<AdvanceResult> {
  const { data: matter } = await supabase.from('legal_matters').select('id, status').eq('id', args.matterId).single()
  if (!matter || matter.status !== args.stageKey) {
    return { advanced: false, reason: 'stale' }
  }

  await markAssignmentCompletionGates(supabase, {
    matterId: args.matterId, submissionId: null, stageKey: args.stageKey,
    assignmentId: args.assignmentId, actorId: args.actorId,
  })

  const facts = await computeGateFacts(supabase, { matterId: args.matterId, submissionId: null, stageKey: args.stageKey })
  if (!gatesSatisfied(args.stageKey, facts)) {
    const unmet = evaluateGates(args.stageKey, facts).filter(r => !r.met).map(r => r.gate.label)
    return { advanced: false, reason: 'gates_unmet', unmetGates: unmet }
  }

  const next = nextHappyStage(args.stageKey as MatterStage)
  if (!next) return { advanced: false, reason: 'end_of_path' }

  await supabase.from('legal_matters').update({ status: next, updated_at: new Date().toISOString() }).eq('id', args.matterId)
  await supabase.from('matter_stage_history').insert({
    matter_id: args.matterId, from_stage: args.stageKey, to_stage: next, changed_by: args.actorId,
  })
  await logAudit({
    table_name: 'legal_matters', record_id: args.matterId, action: 'UPDATE', performed_by: args.actorId,
    new_data: { status: next, reason: `auto-advanced on approval of assignment ${args.assignmentId}` },
  })

  return { advanced: true, from: args.stageKey, to: next }
}

/** Same mechanism, for the pre-matter intake pipeline (submissions.intake_stage). */
export async function evaluateAndAdvanceIntakeStage(
  supabase: SupabaseClient,
  args: { submissionId: string; stageKey: string; assignmentId: string; actorId: string },
): Promise<AdvanceResult> {
  const { data: submission } = await supabase.from('submissions').select('id, intake_stage').eq('id', args.submissionId).single()
  if (!submission || submission.intake_stage !== args.stageKey) {
    return { advanced: false, reason: 'stale' }
  }

  await markAssignmentCompletionGates(supabase, {
    matterId: null, submissionId: args.submissionId, stageKey: args.stageKey,
    assignmentId: args.assignmentId, actorId: args.actorId,
  })

  const facts = await computeGateFacts(supabase, { matterId: null, submissionId: args.submissionId, stageKey: args.stageKey })
  if (!gatesSatisfied(args.stageKey, facts)) {
    const unmet = evaluateGates(args.stageKey, facts).filter(r => !r.met).map(r => r.gate.label)
    return { advanced: false, reason: 'gates_unmet', unmetGates: unmet }
  }

  const next = nextHappyIntakeStage(args.stageKey as IntakeStage)
  if (!next) return { advanced: false, reason: 'end_of_path' }

  await supabase.from('submissions').update({ intake_stage: next }).eq('id', args.submissionId)
  await supabase.from('submission_events').insert({
    submission_id: args.submissionId, type: 'status_changed', detail: `${args.stageKey} -> ${next}`, actor_id: args.actorId,
  })
  await logAudit({
    table_name: 'submissions', record_id: args.submissionId, action: 'UPDATE', performed_by: args.actorId,
    new_data: { intake_stage: next, reason: `auto-advanced on approval of assignment ${args.assignmentId}` },
  })

  return { advanced: true, from: args.stageKey, to: next }
}

/**
 * Administrator override: force every unmet gate at this stage satisfied
 * (recorded with source: 'override', not silently skipped) and advance.
 * Callers must check canOverrideGates(permissions) before invoking this.
 */
export async function overrideAndAdvanceStage(
  supabase: SupabaseClient,
  args: { matterId?: string | null; submissionId?: string | null; stageKey: string; actorId: string },
): Promise<AdvanceResult> {
  const gates = STAGE_GATES[args.stageKey] || []
  if (gates.length > 0) {
    await supabase.from('stage_completions').upsert(
      gates.map(g => ({
        matter_id: args.matterId || null,
        submission_id: args.submissionId || null,
        stage_key: args.stageKey,
        gate_id: g.id,
        source: 'override' as const,
        satisfied_by: args.actorId,
        assignment_id: null,
      })),
      { onConflict: 'matter_id,submission_id,stage_key,gate_id' },
    )
  }

  if (args.matterId) {
    const next = nextHappyStage(args.stageKey as MatterStage)
    if (!next) return { advanced: false, reason: 'end_of_path' }
    await supabase.from('legal_matters').update({ status: next, updated_at: new Date().toISOString() }).eq('id', args.matterId)
    await supabase.from('matter_stage_history').insert({
      matter_id: args.matterId, from_stage: args.stageKey, to_stage: next, changed_by: args.actorId,
    })
    await logAudit({
      table_name: 'legal_matters', record_id: args.matterId, action: 'UPDATE', performed_by: args.actorId,
      new_data: { status: next, reason: `stage gates overridden by ${args.actorId}` },
    })
    return { advanced: true, from: args.stageKey, to: next }
  }

  if (args.submissionId) {
    const next = nextHappyIntakeStage(args.stageKey as IntakeStage)
    if (!next) return { advanced: false, reason: 'end_of_path' }
    await supabase.from('submissions').update({ intake_stage: next }).eq('id', args.submissionId)
    await supabase.from('submission_events').insert({
      submission_id: args.submissionId, type: 'status_changed', detail: `${args.stageKey} -> ${next} (override)`, actor_id: args.actorId,
    })
    await logAudit({
      table_name: 'submissions', record_id: args.submissionId, action: 'UPDATE', performed_by: args.actorId,
      new_data: { intake_stage: next, reason: `stage gates overridden by ${args.actorId}` },
    })
    return { advanced: true, from: args.stageKey, to: next }
  }

  return { advanced: false, reason: 'stale' }
}
