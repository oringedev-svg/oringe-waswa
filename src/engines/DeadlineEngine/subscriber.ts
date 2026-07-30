/**
 * Deadline Engine Subscriber
 *
 * Subscribes to: hearing_scheduled
 * Computes: Filing deadlines based on hearing date and judge preferences
 * Output: Stores in deadline_engine_results (status: proposed)
 *
 * Rule: Engine NEVER writes to Matter Record directly.
 * Deadlines only become facts via a "ConfirmDeadline" Activity.
 */

import { DomainEvent, EventBus } from '@/lib/event-bus/EventBus'
import { JudgesRepository } from '@/lib/repositories/knowledge-hub/JudgesRepository'
import { PostgresDeadlineEngineRepository } from '@/lib/repositories/engines/DeadlineEngineRepository'
import { logger } from '@/lib/logging/logger'

/**
 * Simple deadline computation rules.
 * In production, these would be much more sophisticated.
 */
const DEADLINE_RULES = {
  mention: { daysAfter: 5, type: 'filing' as const },
  hearing: { daysAfter: 14, type: 'filing' as const },
  pre_trial_conference: { daysAfter: 7, type: 'filing' as const },
  ruling: { daysAfter: 21, type: 'response' as const },
  default: { daysAfter: 7, type: 'response' as const },
}

export class DeadlineEngineSubscriber {
  constructor(
    private judgesHub: JudgesRepository,
    private deadlineEngine: PostgresDeadlineEngineRepository,
  ) {}

  /**
   * Subscribe to domain events that define deadlines.
   */
  subscribe(eventBus: EventBus): void {
    eventBus.subscribe('hearing_scheduled', (event) => this.handleHearingScheduled(event))
    logger.info('DeadlineEngine subscribed to events')
  }

  private async handleHearingScheduled(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as any
      const matterId = payload.matterId
      const hearingDate = new Date(payload.hearingDate)
      const judgeId = payload.judgeId
      const purpose = payload.purpose

      logger.info('DeadlineEngine handling hearing_scheduled', {
        matterId,
        hearingDate,
        purpose,
      })

      // Get judge preferences (if a judge is assigned)
      let daysOffset = 7 // Default
      if (judgeId) {
        try {
          const judge = await this.judgesHub.getJudge(judgeId)
          const filingDays = judge.filingPreferences?.filing_days_after_hearing
          if (filingDays && typeof filingDays === 'number') {
            daysOffset = filingDays
          }
        } catch (err) {
          logger.warn('Failed to fetch judge preferences', {
            judgeId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // Compute deadline based on hearing purpose
      const rule =
        DEADLINE_RULES[purpose as keyof typeof DEADLINE_RULES] || DEADLINE_RULES.default
      const dueDate = new Date(hearingDate.getTime() + rule.daysAfter * 24 * 60 * 60 * 1000)

      // Store proposed deadline
      await this.deadlineEngine.saveDeadline({
        matterId,
        status: 'proposed',
        deadlineType: rule.type,
        dueDate,
        description: `Filing deadline following ${purpose} on ${hearingDate.toDateString()}`,
        sourceEvent: 'hearing_scheduled',
        sourceHearingId: payload.hearingId,
        computedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
      })

      logger.info('DeadlineEngine hearing_scheduled handled', {
        matterId,
        dueDate,
        daysOffset,
      })
    } catch (err) {
      logger.error('DeadlineEngine hearing_scheduled failed', err as Error, {
        eventId: event.eventId,
        matterId: event.matterId,
      })

      // Non-blocking: don't throw
    }
  }
}

/**
 * Factory function to create and subscribe a Deadline Engine.
 */
export function createDeadlineEngineSubscriber(
  judgesHub: JudgesRepository,
  deadlineEngine: PostgresDeadlineEngineRepository,
): DeadlineEngineSubscriber {
  return new DeadlineEngineSubscriber(judgesHub, deadlineEngine)
}
