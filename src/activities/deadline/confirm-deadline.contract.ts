/**
 * Confirm Deadline Output Contract
 *
 * Validates and orchestrates deadline promotion/rejection.
 * Follows the reference pattern from ScheduleHearing.
 *
 * Input: deadlineId, approved (bool), confirmedBy (profile_id), notes
 * Output: Updates deadline_engine_results status, optionally writes to Matter Record
 * Events: deadline_confirmed (after commit)
 */

import { z } from 'zod'
import { PostgresDeadlineEngineRepository } from '@/lib/repositories/engines/DeadlineEngineRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

const ConfirmDeadlineInputSchema = z.object({
  deadlineId: z.string().uuid('deadlineId must be a valid UUID'),
  approved: z.boolean(),
  confirmedBy: z.string().uuid('confirmedBy must be a valid UUID'),
  notes: z.string().optional(),
})

export type ConfirmDeadlineInput = z.infer<typeof ConfirmDeadlineInputSchema>

export interface ConfirmDeadlineOutput {
  deadlineId: string
  status: 'promoted' | 'rejected'
  updatedAt: Date
}

export class ConfirmDeadlineOutputContract {
  constructor(
    private deadlineEngineRepository: PostgresDeadlineEngineRepository,
    private eventPublisher: EventPublisher,
    private firmId: string,
  ) {}

  async execute(input: unknown): Promise<ConfirmDeadlineOutput> {
    // 1. Validate input schema
    const validation = ConfirmDeadlineInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('ConfirmDeadline input validation failed', new Error(errors.join('; ')))
      throw new ValidationError('Invalid deadline confirmation input', { errors })
    }

    const { deadlineId, approved, confirmedBy, notes } = validation.data

    try {
      logger.info('ConfirmDeadline contract executing', {
        deadlineId,
        approved,
        firmId: this.firmId,
      })

      // 2. Fetch existing deadline
      const allDeadlines = await this.deadlineEngineRepository.getAllDeadlines(this.firmId)
      const deadline = allDeadlines.find((d) => d.id === deadlineId)

      if (!deadline) {
        throw new NotFoundError('Deadline not found', { deadlineId })
      }

      // 3. Update deadline status
      const updatedAt = new Date()

      if (approved) {
        // Promote deadline to confirmed
        await this.deadlineEngineRepository.promoteDeadline(deadlineId, confirmedBy)
        logger.info('ConfirmDeadline promoted', {
          deadlineId,
          dueDate: deadline.dueDate,
        })
      } else {
        // Reject deadline
        await this.deadlineEngineRepository.rejectDeadline(deadlineId, confirmedBy)
        logger.info('ConfirmDeadline rejected', {
          deadlineId,
          reason: notes,
        })
      }

      // 4. Emit domain event (after commit)
      await this.eventPublisher.publish({
        eventId: `deadline_confirmed_${deadlineId}_${Date.now()}`,
        eventType: 'deadline_confirmed',
        matterId: deadline.matterId,
        timestamp: updatedAt,
        payload: {
          deadlineId,
          approved,
          confirmedBy,
          notes,
          dueDate: deadline.dueDate,
          deadlineType: deadline.deadlineType,
        },
      })

      logger.info('ConfirmDeadline event emitted', {
        deadlineId,
        eventType: 'deadline_confirmed',
      })

      return {
        deadlineId,
        status: approved ? 'promoted' : 'rejected',
        updatedAt,
      }
    } catch (error) {
      logger.error('ConfirmDeadline contract failed', error as Error, {
        deadlineId,
        firmId: this.firmId,
      })
      throw error
    }
  }
}
