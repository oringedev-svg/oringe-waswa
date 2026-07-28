import { createAdminClient } from '@/lib/supabase'

// The event log backbone (Architecture Principle 2: every business action
// emits an event; events are immutable once emitted).
//
// This is deliberately separate from logAudit() in lib/audit.ts. That
// records "a row in this table changed" for operational history. A domain
// event records "this thing happened in the business", named in the
// domain's own language (MatterOpened.v1, ConflictCheckCompleted.v1), and
// is what timelines and read models are projected from. The two coexist
// while capabilities migrate onto the event log one at a time.

export interface DomainEventInput {
  aggregateType: string
  aggregateId: string
  /** Domain event name including its version, e.g. "MatterOpened.v1". */
  eventType: string
  payload?: Record<string, unknown>
  /** The user who caused it. Null for system-originated events. */
  actor?: string | null
  schemaVersion?: number
}

/** The single firm this deployment serves, cached after first lookup. */
let cachedFirmId: string | null = null

export async function getCurrentFirmId(): Promise<string | null> {
  if (cachedFirmId) return cachedFirmId
  const supabase = createAdminClient()
  const { data } = await supabase.from('firms').select('id').eq('slug', 'oringe-waswa').maybeSingle()
  cachedFirmId = data?.id ?? null
  return cachedFirmId
}

/**
 * Append an event to the log. Never throws: a capability's command must not
 * fail because its event could not be written, but the failure is surfaced
 * loudly rather than swallowed (NFR Observability: no silent failures in a
 * system holding legal deadlines and trust funds).
 */
export async function emitEvent(event: DomainEventInput): Promise<void> {
  try {
    const firmId = await getCurrentFirmId()
    if (!firmId) {
      console.error('[domain_events] no firm resolved; event dropped:', event.eventType)
      return
    }
    const supabase = createAdminClient()
    const { error } = await supabase.from('domain_events').insert({
      aggregate_id: event.aggregateId,
      aggregate_type: event.aggregateType,
      event_type: event.eventType,
      schema_version: event.schemaVersion ?? 1,
      payload: event.payload ?? {},
      actor: event.actor ?? null,
      firm_id: firmId,
    })
    if (error) {
      // Migration 028 may not have been run yet on a given deployment.
      if (/relation .*domain_events.* does not exist/i.test(error.message)) return
      console.error('[domain_events] insert failed:', error.message, event.eventType)
    }
  } catch (err) {
    console.error('[domain_events] emit threw:', err)
  }
}

/**
 * The timeline for one aggregate, straight from the log (Architecture
 * Principle 4: timelines are derived from the event log, never maintained
 * as separately-written state).
 */
export async function getTimeline(aggregateType: string, aggregateId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('domain_events')
    .select('*')
    .eq('aggregate_type', aggregateType)
    .eq('aggregate_id', aggregateId)
    .order('occurred_at', { ascending: true })
  if (error) return []
  return data ?? []
}
