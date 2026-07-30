import { createAdminClient } from './supabase'
import { emitEvent, getCurrentFirmId, type DomainEventInput } from './domainEvents'

// The reactive core the workflow philosophy calls for: application code
// emits business events (via emitAndProcess below, instead of calling
// emitEvent directly wherever a trigger reaction is wanted), and
// activity_trigger_rules decides what happens next. No workflow logic
// belongs in the route handlers that call this, only "this legal event
// happened."

export interface ProcessableEvent extends DomainEventInput {
  /** The matter this event concerns, when there is one. Used to resolve
   *  matter-type-scoped rules and to attach created work items. */
  matterId?: string | null
  submissionId?: string | null
  /** legal_matters.type, resolved by the caller when known, avoids a
   *  round-trip here for the common case where the caller already has it. */
  matterType?: string | null
}

interface ActivityTriggerRule {
  id: string
  source_event: string
  matter_type: string | null
  conditions: Record<string, unknown>
  creates_activity_type_id: string | null
  assignment_strategy: 'manual' | 'matter_lead' | 'source_owner' | 'role_queue'
  target_role: string | null
  emits_event: string | null
  delay_days: number | null
  is_active: boolean
}

interface ActivityType {
  id: string
  name: string
  description: string | null
  default_due_days: number | null
  default_urgency: string
}

/** Emit a domain event and immediately run any trigger rules reacting to
 *  it. Use this instead of emitEvent() directly wherever the event should
 *  actually drive the workflow forward, not just log a fact. */
export async function emitAndProcess(event: ProcessableEvent): Promise<void> {
  await emitEvent(event)
  await processDomainEvent(event)
}

async function resolveAssignee(
  strategy: string,
  matterId: string | null,
  actorProfileId: string | null | undefined
): Promise<string | null> {
  const supabase = createAdminClient()
  if (strategy === 'matter_lead' && matterId) {
    const { data } = await supabase.from('legal_matters').select('assigned_attorney_id').eq('id', matterId).maybeSingle()
    return data?.assigned_attorney_id ?? null
  }
  if (strategy === 'source_owner' && actorProfileId) {
    const { data } = await supabase.from('team_members').select('id').eq('profile_id', actorProfileId).maybeSingle()
    return data?.id ?? null
  }
  // 'manual' and 'role_queue': no automatic assignee, created unassigned
  // for a human to claim (role_queue additionally records target_role on
  // the work item so a filtered queue view can show it to the right people).
  return null
}

/** React to one event: find matching rules and either create the work
 *  item they specify, or (for immediate, non-delayed emits) relay to a
 *  follow-on event. Delayed rules are intentionally skipped here, they're
 *  evaluated on a schedule instead, see evaluateDelayedTriggers(). */
export async function processDomainEvent(event: ProcessableEvent): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { data: rules, error } = await supabase
      .from('activity_trigger_rules')
      .select('*')
      .eq('source_event', event.eventType)
      .eq('is_active', true)

    if (error) {
      console.error('[triggerEngine] processDomainEvent query failed:', error.message)
      return
    }
    if (!rules) return

    for (const rule of rules as ActivityTriggerRule[]) {
      if (rule.matter_type && event.matterType && rule.matter_type !== event.matterType) continue
      if (rule.delay_days) continue

      if (rule.creates_activity_type_id) {
        await createWorkItemFromRule(rule, event)
      } else if (rule.emits_event) {
        await emitAndProcess({
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: rule.emits_event,
          payload: event.payload,
          actor: event.actor,
          matterId: event.matterId,
          submissionId: event.submissionId,
          matterType: event.matterType,
        })
      }
    }
  } catch (err) {
    console.error('[triggerEngine] processDomainEvent failed:', err)
  }
}

async function createWorkItemFromRule(rule: ActivityTriggerRule, event: ProcessableEvent) {
  const supabase = createAdminClient()
  const { data: activityType } = await supabase
    .from('activity_types')
    .select('id, name, description, default_due_days, default_urgency')
    .eq('id', rule.creates_activity_type_id)
    .single<ActivityType>()
  if (!activityType) return

  if (!event.matterId && !event.submissionId) return // work_items require one

  const firmId = await getCurrentFirmId()
  if (!firmId) return

  const assigneeProfileId = await resolveAssignee(rule.assignment_strategy, event.matterId ?? null, event.actor)
  const dueAt = activityType.default_due_days
    ? new Date(Date.now() + activityType.default_due_days * 86400000).toISOString()
    : null

  const { data: workItem, error } = await supabase
    .from('work_items')
    .insert({
      firm_id: firmId,
      activity_type_id: activityType.id,
      matter_id: event.matterId ?? null,
      submission_id: event.submissionId ?? null,
      title: activityType.name,
      instructions: activityType.description,
      due_at: dueAt,
      urgency: activityType.default_urgency,
      status: 'queued',
      assigned_to_profile_id: assigneeProfileId,
      context_snapshot: { triggered_by: event.eventType, target_role: rule.target_role, ...(event.payload || {}) },
    })
    .select('id')
    .single()

  if (error) {
    console.error('[triggerEngine] work item creation failed:', error.message)
    return
  }

  await emitEvent({
    aggregateType: 'WorkItem',
    aggregateId: workItem.id,
    eventType: 'WorkItemCreated.v1',
    actor: null,
    payload: { activity_type: activityType.name, triggered_by: event.eventType, matter_id: event.matterId, submission_id: event.submissionId },
  })
}

/** Evaluate every rule with a delay_days set: has enough time passed
 *  since its source_event fired for a given aggregate, and hasn't its
 *  action already happened for that same aggregate? Meant to be called by
 *  a scheduled job (see /api/cron/evaluate-triggers), this is the
 *  "statutory time expired" half of the engine, the other half being the
 *  immediate reactions in processDomainEvent above. */
export async function evaluateDelayedTriggers(): Promise<{ fired: number; error?: string }> {
  const supabase = createAdminClient()
  let fired = 0

  const { data: rules, error: rulesError } = await supabase
    .from('activity_trigger_rules')
    .select('*')
    .eq('is_active', true)
    .not('delay_days', 'is', null)

  // A schema error here (e.g. migration 034 not yet applied) must not read
  // as "nothing due", that silently hides the feature being inert.
  if (rulesError) {
    console.error('[triggerEngine] evaluateDelayedTriggers query failed:', rulesError.message)
    return { fired: 0, error: rulesError.message }
  }

  for (const rule of (rules || []) as ActivityTriggerRule[]) {
    const cutoff = new Date(Date.now() - (rule.delay_days as number) * 86400000).toISOString()

    const { data: sourceEvents } = await supabase
      .from('domain_events')
      .select('id, aggregate_type, aggregate_id, occurred_at, actor, payload')
      .eq('event_type', rule.source_event)
      .lte('occurred_at', cutoff)

    for (const src of sourceEvents || []) {
      // Has this rule already acted on this aggregate? Check for the
      // resulting event/work item rather than a separate bookkeeping
      // table, the domain event log is already the source of truth.
      if (rule.emits_event) {
        const { count } = await supabase
          .from('domain_events')
          .select('id', { count: 'exact', head: true })
          .eq('event_type', rule.emits_event)
          .eq('aggregate_id', src.aggregate_id)
        if ((count || 0) > 0) continue

        await emitAndProcess({
          aggregateType: src.aggregate_type,
          aggregateId: src.aggregate_id,
          eventType: rule.emits_event,
          payload: src.payload || {},
          actor: src.actor,
          matterId: src.aggregate_type === 'Matter' ? src.aggregate_id : undefined,
        })
        fired++
      } else if (rule.creates_activity_type_id) {
        const { count } = await supabase
          .from('work_items')
          .select('id', { count: 'exact', head: true })
          .eq('activity_type_id', rule.creates_activity_type_id)
          .contains('context_snapshot', { triggered_by: rule.source_event })
          .or(`matter_id.eq.${src.aggregate_id},submission_id.eq.${src.aggregate_id}`)
        if ((count || 0) > 0) continue

        await createWorkItemFromRule(rule, {
          aggregateType: src.aggregate_type,
          aggregateId: src.aggregate_id,
          eventType: rule.source_event,
          payload: src.payload || {},
          actor: src.actor,
          matterId: src.aggregate_type === 'Matter' ? src.aggregate_id : null,
        })
        fired++
      }
    }
  }

  return { fired }
}
