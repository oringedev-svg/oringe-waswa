/**
 * Update Court Division Output Contract
 */

import { z } from 'zod'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { NotFoundError } from '@/lib/errors/DomainError'

const UpdateCourtDivisionInputSchema = z.object({
  divisionId: z.string().uuid(),
  updates: z.object({
    name: z.string().min(1).optional(),
    divisionCode: z.string().min(1).optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
  }),
})

export class UpdateCourtDivisionOutputContract {
  constructor(
    private divisionsRepository: PostgresCourtDivisionsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = UpdateCourtDivisionInputSchema.safeParse(input)
    if (!validation.success) throw new Error('Invalid input')

    const { divisionId, updates } = validation.data

    try {
      logger.info('UpdateCourtDivision contract executing', { divisionId })

      const existing = await this.divisionsRepository.getDivision(divisionId)
      if (!existing) throw new NotFoundError('Court division not found', { divisionId })

      const division = await this.divisionsRepository.updateDivision(divisionId, updates)

      await this.eventPublisher.publish({
        eventId: `court_division_updated_${divisionId}_${Date.now()}`,
        eventType: 'court_division_updated',
        matterId: null,
        timestamp: division.updatedAt,
        payload: { divisionId, ...updates },
      })

      return { id: division.id, courtId: division.courtId, name: division.name }
    } catch (error) {
      logger.error('UpdateCourtDivision contract failed', error as Error, { divisionId })
      throw error
    }
  }
}
