/**
 * Delete Court Output Contract
 *
 * Admin deletes court reference data.
 * Note: In production, consider soft-deletes instead of hard deletes.
 *
 * Input: courtId
 * Output: { courtId, deletedAt }
 * Events: court_deleted (after commit)
 */

import { z } from 'zod'
import { PostgresCourtsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

const DeleteCourtInputSchema = z.object({
  courtId: z.string().uuid('courtId must be a valid UUID'),
})

export type DeleteCourtInput = z.infer<typeof DeleteCourtInputSchema>

export interface DeleteCourtOutput {
  courtId: string
  deletedAt: Date
}

export class DeleteCourtOutputContract {
  constructor(
    private courtsAdminRepository: PostgresCourtsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown): Promise<DeleteCourtOutput> {
    // 1. Validate input
    const validation = DeleteCourtInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('DeleteCourt input validation failed', { errors })
      throw new ValidationError(`Invalid court deletion input: ${errors.join('; ')}`)
    }

    const { courtId } = validation.data

    try {
      logger.info('DeleteCourt contract executing', {
        courtId,
      })

      // 2. Verify court exists
      const existing = await this.courtsAdminRepository.getCourt(courtId)
      if (!existing) {
        throw new NotFoundError('Court', courtId)
      }

      // 3. Delete court
      await this.courtsAdminRepository.deleteCourt(courtId)

      logger.info('Court deleted', {
        courtId,
      })

      // 4. Emit domain event
      const deletedAt = new Date()
      await this.eventPublisher.publish({
        eventId: `court_deleted_${courtId}_${Date.now()}`,
        type: 'court_deleted',
        firmId: (await getCurrentFirmId())!,
        aggregateId: courtId,
        aggregateType: 'court',
        occurredAt: deletedAt,
        payload: {
          courtId,
          name: existing.name,
          jurisdiction: existing.jurisdiction,
        },
      })

      logger.info('DeleteCourt event emitted', {
        courtId,
        eventType: 'court_deleted',
      })

      return {
        courtId,
        deletedAt,
      }
    } catch (error) {
      logger.error('DeleteCourt contract failed', error as Error, {
        courtId,
      })
      throw error
    }
  }
}
