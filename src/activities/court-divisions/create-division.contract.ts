/**
 * Create Court Division Output Contract
 *
 * Admin creates new court division.
 * Divisions are hierarchical under courts.
 *
 * Input: courtId, name, divisionCode, address?, phone?
 * Output: CourtDivision object
 * Events: court_division_created (after commit)
 */

import { z } from 'zod'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError } from '@/lib/errors/DomainError'

const CreateCourtDivisionInputSchema = z.object({
  courtId: z.string().uuid('courtId must be a valid UUID'),
  name: z.string().min(1, 'Division name is required'),
  divisionCode: z.string().min(1, 'Division code is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
})

export type CreateCourtDivisionInput = z.infer<typeof CreateCourtDivisionInputSchema>

export interface CreateCourtDivisionOutput {
  id: string
  courtId: string
  name: string
  divisionCode: string
  createdAt: Date
}

export class CreateCourtDivisionOutputContract {
  constructor(
    private divisionsAdminRepository: PostgresCourtDivisionsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown): Promise<CreateCourtDivisionOutput> {
    // 1. Validate input
    const validation = CreateCourtDivisionInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('CreateCourtDivision input validation failed', new Error(errors.join('; ')))
      throw new ValidationError('Invalid court division creation input', { errors })
    }

    const { courtId, name, divisionCode, address, phone } = validation.data

    try {
      logger.info('CreateCourtDivision contract executing', {
        courtId,
        name,
        divisionCode,
      })

      // 2. Create division
      const division = await this.divisionsAdminRepository.createDivision({
        courtId,
        name,
        divisionCode,
        address,
        phone,
      })

      logger.info('Court division created', {
        divisionId: division.id,
        courtId: division.courtId,
        name: division.name,
      })

      // 3. Emit domain event
      await this.eventPublisher.publish({
        eventId: `court_division_created_${division.id}_${Date.now()}`,
        eventType: 'court_division_created',
        matterId: null,
        timestamp: division.createdAt,
        payload: {
          divisionId: division.id,
          courtId: division.courtId,
          name: division.name,
          divisionCode: division.divisionCode,
        },
      })

      logger.info('CreateCourtDivision event emitted', {
        divisionId: division.id,
        eventType: 'court_division_created',
      })

      return {
        id: division.id,
        courtId: division.courtId,
        name: division.name,
        divisionCode: division.divisionCode,
        createdAt: division.createdAt,
      }
    } catch (error) {
      logger.error('CreateCourtDivision contract failed', error as Error, {
        courtId,
        name,
      })
      throw error
    }
  }
}
