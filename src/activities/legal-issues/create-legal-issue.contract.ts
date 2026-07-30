/**
 * Create Legal Issue Output Contract
 *
 * User identifies a legal issue for a matter.
 * Issues feed into the Risk Assessment Engine.
 *
 * Input: matterId, issueType, title, description, severity
 * Output: LegalIssue object
 * Events: legal_issue_created (triggers Risk Assessment Engine)
 */

import { z } from 'zod'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

const CreateLegalIssueInputSchema = z.object({
  matterId: z.string().uuid('matterId must be a valid UUID'),
  issueType: z.string().min(1, 'Issue type is required'),
  title: z.string().min(1, 'Issue title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export type CreateLegalIssueInput = z.infer<typeof CreateLegalIssueInputSchema>

export interface CreateLegalIssueOutput {
  id: string
  matterId: string
  title: string
  severity: string
  createdAt: Date
}

export class CreateLegalIssueOutputContract {
  constructor(
    private issuesRepository: PostgresLegalIssuesRepository,
    private matterRecordRepository: MatterRecordRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown): Promise<CreateLegalIssueOutput> {
    // 1. Validate input schema
    const validation = CreateLegalIssueInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      logger.warn('CreateLegalIssue input validation failed', { errors })
      throw new ValidationError(`Invalid legal issue input: ${errors.join('; ')}`)
    }

    const { matterId, issueType, title, description, severity } = validation.data

    try {
      logger.info('CreateLegalIssue contract executing', {
        matterId,
        issueType,
        title,
      })

      // 2. Verify matter exists
      const matter = await this.matterRecordRepository.getMatter(matterId)
      if (!matter) {
        throw new NotFoundError('Matter', matterId)
      }

      // 3. Create legal issue
      const issue = await this.issuesRepository.createIssue({
        matterId,
        issueType,
        title,
        description,
        severity: severity as 'low' | 'medium' | 'high' | 'critical',
      })

      logger.info('Legal issue created', {
        issueId: issue.id,
        matterId: issue.matterId,
        title: issue.title,
      })

      // 4. Emit domain event (triggers Risk Assessment Engine)
      await this.eventPublisher.publish({
        eventId: `legal_issue_created_${issue.id}_${Date.now()}`,
        type: 'legal_issue_created',
        firmId: (await getCurrentFirmId())!,
        matterId: issue.matterId,
        aggregateId: issue.id,
        aggregateType: 'legal_issue',
        occurredAt: issue.createdAt,
        payload: {
          issueId: issue.id,
          matterId: issue.matterId,
          issueType: issue.issueType,
          title: issue.title,
          severity: issue.severity,
        },
      })

      logger.info('CreateLegalIssue event emitted', {
        issueId: issue.id,
        eventType: 'legal_issue_created',
      })

      return {
        id: issue.id,
        matterId: issue.matterId,
        title: issue.title,
        severity: issue.severity,
        createdAt: issue.createdAt,
      }
    } catch (error) {
      logger.error('CreateLegalIssue contract failed', error as Error, {
        matterId,
        title,
      })
      throw error
    }
  }
}
