/**
 * Create Court Output Contract
 *
 * Admin creates new court reference data.
 * Follows the reference pattern from ScheduleHearing.
 *
 * Input: name, jurisdiction, address?, phone?, website?
 * Output: Court object
 * Events: court_created (after commit)
 */

import { z } from 'zod'
import { PostgresCourtsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError } from '@/lib/errors/DomainError'

const CreateCourtInputSchema = z.object({
  name: z.string().min(1, 'Court name is required'),
  jurisdiction: z.string().min(1, 'Jurisdiction is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url('Website must be a valid URL').optional(),
})

export type CreateCourtInput = z.infer<typeof CreateCourtInputSchema>

export interface CreateCourtOutput {
  id: string
  name: string
  jurisdiction: string
  createdAt: Date
}

export class CreateCourtOutputContract {
  constructor(
    private courtsAdminRepository: PostgresCourtsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown): Promise<CreateCourtOutput> {
    // 1. Validate input schema
    const validation = CreateCourtInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('CreateCourt input validation failed', new Error(errors.join('; ')))
      throw new ValidationError('Invalid court creation input', { errors })
    }

    const { name, jurisdiction, address, phone, website } = validation.data

    try {
      logger.info('CreateCourt contract executing', {
        name,
        jurisdiction,
      })

      // 2. Create court
      const court = await this.courtsAdminRepository.createCourt({
        name,
        jurisdiction,
        address,
        phone,
        website,
      })

      logger.info('Court created', {
        courtId: court.id,
        name: court.name,
        jurisdiction: court.jurisdiction,
      })

      // 3. Emit domain event (after commit)
      await this.eventPublisher.publish({
        eventId: `court_created_${court.id}_${Date.now()}`,
        eventType: 'court_created',
        matterId: null, // Knowledge Hub events don't have a matter
        timestamp: court.createdAt,
        payload: {
          courtId: court.id,
          name: court.name,
          jurisdiction: court.jurisdiction,
        },
      })

      logger.info('CreateCourt event emitted', {
        courtId: court.id,
        eventType: 'court_created',
      })

      return {
        id: court.id,
        name: court.name,
        jurisdiction: court.jurisdiction,
        createdAt: court.createdAt,
      }
    } catch (error) {
      logger.error('CreateCourt contract failed', error as Error, {
        name,
        jurisdiction,
      })
      throw error
    }
  }
}
