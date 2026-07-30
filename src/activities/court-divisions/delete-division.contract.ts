/**
 * Delete Court Division Output Contract
 */

import { z } from 'zod'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { NotFoundError } from '@/lib/errors/DomainError'

const DeleteCourtDivisionInputSchema = z.object({
  divisionId: z.string().uuid(),
})

export class DeleteCourtDivisionOutputContract {
  constructor(
    private divisionsRepository: PostgresCourtDivisionsAdminRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = DeleteCourtDivisionInputSchema.safeParse(input)
    if (!validation.success) throw new Error('Invalid input')

    const { divisionId } = validation.data

    try {
      logger.info('DeleteCourtDivision contract executing', { divisionId })

      const existing = await this.divisionsRepository.getDivision(divisionId)
      if (!existing) throw new NotFoundError('Court division not found', { divisionId })

      await this.divisionsRepository.deleteDivision(divisionId)

      await this.eventPublisher.publish({
        eventId: `court_division_deleted_${divisionId}_${Date.now()}`,
        eventType: 'court_division_deleted',
        matterId: null,
        timestamp: new Date(),
        payload: { divisionId, courtId: existing.courtId },
      })

      return { divisionId, deletedAt: new Date() }
    } catch (error) {
      logger.error('DeleteCourtDivision contract failed', error as Error, { divisionId })
      throw error
    }
  }
}
