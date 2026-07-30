/**
 * Update Legal Issue Output Contract
 */

import { z } from 'zod'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

const UpdateLegalIssueInputSchema = z.object({
  issueId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().min(10).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
})

export type UpdateLegalIssueInput = z.infer<typeof UpdateLegalIssueInputSchema>

export class UpdateLegalIssueOutputContract {
  constructor(
    private issuesRepository: PostgresLegalIssuesRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = UpdateLegalIssueInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError(`Invalid legal issue update input: ${errors.join('; ')}`)
    }

    const { issueId, ...updates } = validation.data

    try {
      logger.info('UpdateLegalIssue contract executing', { issueId })

      const existing = await this.issuesRepository.getIssue(issueId)
      if (!existing) {
        throw new NotFoundError('Legal issue', issueId)
      }

      const issue = await this.issuesRepository.updateIssue(issueId, updates)

      await this.eventPublisher.publish({
        eventId: `legal_issue_updated_${issueId}_${Date.now()}`,
        type: 'legal_issue_updated',
        firmId: (await getCurrentFirmId())!,
        matterId: issue.matterId,
        aggregateId: issueId,
        aggregateType: 'legal_issue',
        occurredAt: issue.updatedAt,
        payload: { issueId, ...updates },
      })

      return { id: issue.id, matterId: issue.matterId, title: issue.title }
    } catch (error) {
      logger.error('UpdateLegalIssue contract failed', error as Error, { issueId })
      throw error
    }
  }
}
