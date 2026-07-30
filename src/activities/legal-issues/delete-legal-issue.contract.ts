/**
 * Delete Legal Issue Output Contract
 */

import { z } from 'zod'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { NotFoundError } from '@/lib/errors/DomainError'

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
    if (!validation.success) throw new Error('Invalid input')

    const { issueId } = validation.data

    try {
      logger.info('DeleteLegalIssue contract executing', { issueId })

      const existing = await this.issuesRepository.getIssue(issueId)
      if (!existing) throw new NotFoundError('Legal issue not found', { issueId })

      await this.issuesRepository.deleteIssue(issueId)

      await this.eventPublisher.publish({
        eventId: `legal_issue_deleted_${issueId}_${Date.now()}`,
        eventType: 'legal_issue_deleted',
        matterId: existing.matterId,
        timestamp: new Date(),
        payload: { issueId },
      })

      return { issueId, deletedAt: new Date() }
    } catch (error) {
      logger.error('DeleteLegalIssue contract failed', error as Error, { issueId })
      throw error
    }
  }
}
