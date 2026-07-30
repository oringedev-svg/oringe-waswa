/**
 * Review Conflict Output Contract
 *
 * Validates and orchestrates conflict promotion/rejection.
 * Follows the reference pattern from ScheduleHearing.
 *
 * Input: conflictId, approved (bool), reviewedBy (profile_id), notes
 * Output: Updates conflict_engine_results status
 * Events: conflict_review_completed (after commit)
 */

import { z } from 'zod'
import { ConflictEngineRepository } from '@/lib/repositories/engines/ConflictEngineRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

const ReviewConflictInputSchema = z.object({
  conflictId: z.string().uuid('conflictId must be a valid UUID'),
  approved: z.boolean(),
  reviewedBy: z.string().uuid('reviewedBy must be a valid UUID'),
  notes: z.string().optional(),
})

export type ReviewConflictInput = z.infer<typeof ReviewConflictInputSchema>

export interface ReviewConflictOutput {
  conflictId: string
  status: 'promoted' | 'discarded'
  updatedAt: Date
}

export class ReviewConflictOutputContract {
  constructor(
    private conflictEngineRepository: ConflictEngineRepository,
    private eventPublisher: EventPublisher,
    private firmId: string,
  ) {}

  async execute(input: unknown): Promise<ReviewConflictOutput> {
    // 1. Validate input schema
    const validation = ReviewConflictInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('ReviewConflict input validation failed', new Error(errors.join('; ')))
      throw new ValidationError('Invalid conflict review input', { errors })
    }

    const { conflictId, approved, reviewedBy, notes } = validation.data

    try {
      logger.info('ReviewConflict contract executing', {
        conflictId,
        approved,
        firmId: this.firmId,
      })

      // 2. Fetch existing conflict
      const conflict = await this.conflictEngineRepository.getProposedConflicts(this.firmId)
        .then((conflicts) => conflicts.find((c) => c.id === conflictId))

      if (!conflict) {
        throw new NotFoundError('Conflict not found', { conflictId })
      }

      // 3. Update conflict status
      const newStatus = approved ? 'promoted' : 'discarded'
      const updatedAt = new Date()

      if (approved) {
        // Mark as reviewed then promoted (user confirmed it)
        await this.conflictEngineRepository.markConflictReviewed(conflictId, reviewedBy)
        // In production, could also promote directly here
      } else {
        // Mark as rejected (user dismissed it)
        await this.conflictEngineRepository.recordFailure(conflictId, {
          error: notes || 'Rejected by user',
          timestamp: updatedAt.toISOString(),
        })
      }

      logger.info('ReviewConflict status updated', {
        conflictId,
        newStatus,
      })

      // 4. Emit domain event (after commit)
      await this.eventPublisher.publish({
        eventId: `conflict_review_${conflictId}_${Date.now()}`,
        eventType: 'conflict_review_completed',
        matterId: conflict.matterId,
        timestamp: updatedAt,
        payload: {
          conflictId,
          approved,
          reviewedBy,
          notes,
          status: newStatus,
        },
      })

      logger.info('ReviewConflict event emitted', {
        conflictId,
        eventType: 'conflict_review_completed',
      })

      return {
        conflictId,
        status: newStatus as 'promoted' | 'discarded',
        updatedAt,
      }
    } catch (error) {
      logger.error('ReviewConflict contract failed', error as Error, {
        conflictId,
        firmId: this.firmId,
      })
      throw error
    }
  }
}
