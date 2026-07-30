/**
 * Delete Court Division Output Contract
 */

import { z } from 'zod'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { NotFoundError, ValidationError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

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
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError(`Invalid court division deletion input: ${errors.join('; ')}`)
    }

    const { divisionId } = validation.data

    try {
      logger.info('DeleteCourtDivision contract executing', { divisionId })

      const existing = await this.divisionsRepository.getDivision(divisionId)
      if (!existing) throw new NotFoundError('Court division', divisionId)

      await this.divisionsRepository.deleteDivision(divisionId)

      const deletedAt = new Date()
      await this.eventPublisher.publish({
        eventId: `court_division_deleted_${divisionId}_${Date.now()}`,
        type: 'court_division_deleted',
        firmId: (await getCurrentFirmId())!,
        aggregateId: divisionId,
        aggregateType: 'court_division',
        occurredAt: deletedAt,
        payload: { divisionId, courtId: existing.courtId },
      })

      return { divisionId, deletedAt }
    } catch (error) {
      logger.error('DeleteCourtDivision contract failed', error as Error, { divisionId })
      throw error
    }
  }
}
