/**
 * Confirm Risk Output Contract
 *
 * User confirms and promotes a risk assessment.
 */

import { z } from 'zod'
import { PostgresRiskAssessmentEngineRepository } from '@/lib/repositories/engines/RiskAssessmentEngineRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

const ConfirmRiskInputSchema = z.object({
  assessmentId: z.string().uuid(),
  approved: z.boolean(),
  confirmedBy: z.string().uuid(),
  notes: z.string().optional(),
})

export type ConfirmRiskInput = z.infer<typeof ConfirmRiskInputSchema>

export class ConfirmRiskOutputContract {
  constructor(
    private riskRepository: PostgresRiskAssessmentEngineRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = ConfirmRiskInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError('Invalid risk confirmation input', { errors })
    }

    const { assessmentId, approved, confirmedBy, notes } = validation.data

    try {
      logger.info('ConfirmRisk contract executing', { assessmentId, approved })

      const allAssessments = await this.riskRepository.getAllRiskAssessments()
      const assessment = allAssessments.find((a) => a.id === assessmentId)

      if (!assessment) {
        throw new NotFoundError('Risk assessment not found', { assessmentId })
      }

      if (approved) {
        await this.riskRepository.promoteRiskAssessment(assessmentId, confirmedBy)
      } else {
        await this.riskRepository.rejectRiskAssessment(assessmentId, confirmedBy)
      }

      await this.eventPublisher.publish({
        eventId: `risk_confirmed_${assessmentId}_${Date.now()}`,
        eventType: 'risk_confirmed',
        matterId: assessment.matterId,
        timestamp: new Date(),
        payload: {
          assessmentId,
          approved,
          confirmedBy,
          notes,
          riskScore: assessment.riskScore,
          riskLevel: assessment.riskLevel,
        },
      })

      return {
        assessmentId,
        status: approved ? 'promoted' : 'rejected',
        updatedAt: new Date(),
      }
    } catch (error) {
      logger.error('ConfirmRisk contract failed', error as Error, { assessmentId })
      throw error
    }
  }
}
