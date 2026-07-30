/**
 * Delete Legal Issue Output Contract
 */

import { z } from 'zod'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { NotFoundError, ValidationError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

const DeleteLegalIssueInputSchema = z.object({
  issueId: z.string().uuid(),
})

export class DeleteLegalIssueOutputContract {
  constructor(
    private issuesRepository: PostgresLegalIssuesRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = DeleteLegalIssueInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError(`Invalid legal issue deletion input: ${errors.join('; ')}`)
    }

    const { issueId } = validation.data

    try {
      logger.info('DeleteLegalIssue contract executing', { issueId })

      const existing = await this.issuesRepository.getIssue(issueId)
      if (!existing) throw new NotFoundError('Legal issue', issueId)

      await this.issuesRepository.deleteIssue(issueId)

      const deletedAt = new Date()
      await this.eventPublisher.publish({
        eventId: `legal_issue_deleted_${issueId}_${Date.now()}`,
        type: 'legal_issue_deleted',
        firmId: (await getCurrentFirmId())!,
        matterId: existing.matterId,
        aggregateId: issueId,
        aggregateType: 'legal_issue',
        occurredAt: deletedAt,
        payload: { issueId },
      })

      return { issueId, deletedAt }
    } catch (error) {
      logger.error('DeleteLegalIssue contract failed', error as Error, { issueId })
      throw error
    }
  }
}
