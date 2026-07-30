/**
 * Update Court Output Contract
 *
 * Admin updates existing court reference data.
 * Follows the reference pattern from ScheduleHearing.
 *
 * Input: courtId, updates (name?, jurisdiction?, address?, phone?, website?)
 * Output: Updated court object
 * Events: court_updated (after commit)
 */

import { z } from 'zod'
import { PostgresCourtsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

const UpdateCourtInputSchema = z.object({
  courtId: z.string().uuid('courtId must be a valid UUID'),
  updates: z.object({
    name: z.string().min(1).optional(),
    jurisdiction: z.string().min(1).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),
  }),
})

export type UpdateCourtInput = z.infer<typeof UpdateCourtInputSchema>

export interface UpdateCourtOutput {
  id: string
  name: string
  jurisdiction: string
  updatedAt: Date
}

export class UpdateCourtOutputContract {
  constructor(
    private courtsAdminRepository: PostgresCourtsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown): Promise<UpdateCourtOutput> {
    // 1. Validate input
    const validation = UpdateCourtInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('UpdateCourt input validation failed', new Error(errors.join('; ')))
      throw new ValidationError('Invalid court update input', { errors })
    }

    const { courtId, updates } = validation.data

    try {
      logger.info('UpdateCourt contract executing', {
        courtId,
        updates,
      })

      // 2. Verify court exists
      const existing = await this.courtsAdminRepository.getCourt(courtId)
      if (!existing) {
        throw new NotFoundError('Court not found', { courtId })
      }

      // 3. Update court
      const court = await this.courtsAdminRepository.updateCourt(courtId, updates)

      logger.info('Court updated', {
        courtId: court.id,
        name: court.name,
      })

      // 4. Emit domain event
      await this.eventPublisher.publish({
        eventId: `court_updated_${courtId}_${Date.now()}`,
        eventType: 'court_updated',
        matterId: null,
        timestamp: court.updatedAt,
        payload: {
          courtId: court.id,
          name: court.name,
          jurisdiction: court.jurisdiction,
          changes: updates,
        },
      })

      logger.info('UpdateCourt event emitted', {
        courtId: court.id,
        eventType: 'court_updated',
      })

      return {
        id: court.id,
        name: court.name,
        jurisdiction: court.jurisdiction,
        updatedAt: court.updatedAt,
      }
    } catch (error) {
      logger.error('UpdateCourt contract failed', error as Error, {
        courtId,
      })
      throw error
    }
  }
}
