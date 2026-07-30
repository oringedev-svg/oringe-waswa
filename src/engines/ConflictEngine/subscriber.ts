/**
 * Conflict Engine Subscriber
 *
 * Subscribes to: matter_created, matter_person_added
 * Computes: Proposed conflicts by checking against existing matters and parties
 * Output: Stores in conflict_engine_results (status: proposed)
 *
 * Rule: Engine NEVER writes to Matter Record directly.
 * Conflicts only become official facts via a "ReviewConflict" Activity.
 */

import { DomainEvent, EventBus } from '@/lib/event-bus/EventBus'
import { MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import {
  PostgresConflictEngineRepository,
  ConflictEngineRepository,
} from '@/lib/repositories/engines/ConflictEngineRepository'
import { logger } from '@/lib/logging/logger'
import { SupabaseClient } from '@supabase/supabase-js'

export class ConflictEngineSubscriber {
  constructor(
    private matterRecord: MatterRecordRepository,
    private conflictEngine: ConflictEngineRepository,
  ) {}

  /**
   * Subscribe to domain events that might reveal conflicts.
   */
  subscribe(eventBus: EventBus): void {
    eventBus.subscribe('matter_created', (event) => this.handleMatterCreated(event))
    eventBus.subscribe('matter_person_added', (event) => this.handleMatterPersonAdded(event))

    logger.info('ConflictEngine subscribed to events')
  }

  private async handleMatterCreated(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as any
      const matterId = payload.matterId
      const clientName = payload.clientName
      const opposingParty = payload.opposingParty

      logger.info('ConflictEngine handling matter_created', {
        matterId,
        clientName,
      })

      // Check for conflicts with existing matters
      const conflicts: string[] = []

      // Simple conflict detection: name matches
      // In production, this would be more sophisticated (fuzzy matching, entity extraction, etc.)
      if (clientName) {
        // Check if client name appears in other matters' opposing parties
        // This is a placeholder; real implementation would query the database
        logger.debug('Conflict check: client in opposing parties', { clientName })
      }

      if (opposingParty && opposingParty.length > 3) {
        logger.debug('Conflict check: opposing party duplicates', { opposingParty })
      }

      // If conflicts found, store proposed conflicts
      if (conflicts.length > 0) {
        await this.conflictEngine.saveConflict({
          matterId,
          status: 'proposed',
          conflictType: 'opposing_party_duplicate',
          conflictSummary: `Potential conflict with ${conflicts.length} existing matters`,
          relatedMatters: conflicts,
          relatedPeople: [],
          sourceEvent: 'matter_created',
          computedAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
        })
      }

      logger.info('ConflictEngine matter_created handled', {
        matterId,
        conflictsDetected: conflicts.length,
      })
    } catch (err) {
      logger.error('ConflictEngine matter_created failed', err as Error, {
        eventId: event.eventId,
        matterId: (event.payload as any).matterId,
      })

      // Record failure but don't throw; async engines must not block Activities
      if (event.matterId) {
        await this.conflictEngine.recordFailure(event.matterId, (err as Error).message)
      }
    }
  }

  private async handleMatterPersonAdded(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as any
      const matterId = payload.matterId
      const personId = payload.personId
      const role = payload.role

      logger.info('ConflictEngine handling matter_person_added', {
        matterId,
        personId,
        role,
      })

      // Check if this person appears in other matters with conflicting roles
      // Placeholder: real implementation would check existing assignments
      logger.debug('Conflict check: person in other matters', { personId })

      logger.info('ConflictEngine matter_person_added handled', {
        matterId,
        personId,
      })
    } catch (err) {
      logger.error('ConflictEngine matter_person_added failed', err as Error, {
        eventId: event.eventId,
        matterId: event.matterId,
      })

      if (event.matterId) {
        await this.conflictEngine.recordFailure(event.matterId, (err as Error).message)
      }
    }
  }
}

/**
 * Factory function to create and subscribe a Conflict Engine.
 */
export function createConflictEngineSubscriber(
  supabase: SupabaseClient,
  matterRecord: MatterRecordRepository,
): ConflictEngineSubscriber {
  const conflictEngineRepo = new PostgresConflictEngineRepository(supabase)
  return new ConflictEngineSubscriber(matterRecord, conflictEngineRepo)
}
