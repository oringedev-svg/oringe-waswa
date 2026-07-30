/**
 * Confirm Document Extraction Output Contract
 *
 * User confirms and promotes a document extraction.
 */

import { z } from 'zod'
import { PostgresDocumentIntelligenceEngineRepository } from '@/lib/repositories/engines/DocumentIntelligenceEngineRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

const ConfirmExtractionInputSchema = z.object({
  extractionId: z.string().uuid(),
  approved: z.boolean(),
  confirmedBy: z.string().uuid(),
  notes: z.string().optional(),
})

export type ConfirmExtractionInput = z.infer<typeof ConfirmExtractionInputSchema>

export class ConfirmDocumentExtractionOutputContract {
  constructor(
    private intelligenceRepository: PostgresDocumentIntelligenceEngineRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = ConfirmExtractionInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError('Invalid extraction confirmation input', { errors })
    }

    const { extractionId, approved, confirmedBy, notes } = validation.data

    try {
      logger.info('ConfirmExtraction contract executing', { extractionId, approved })

      const allExtractions = await this.intelligenceRepository.getAllExtractions()
      const extraction = allExtractions.find((e) => e.id === extractionId)

      if (!extraction) {
        throw new NotFoundError('Document extraction not found', { extractionId })
      }

      if (approved) {
        await this.intelligenceRepository.promoteExtraction(extractionId, confirmedBy)
      } else {
        await this.intelligenceRepository.rejectExtraction(extractionId, confirmedBy)
      }

      await this.eventPublisher.publish({
        eventId: `extraction_confirmed_${extractionId}_${Date.now()}`,
        eventType: 'extraction_confirmed',
        matterId: extraction.matterId,
        timestamp: new Date(),
        payload: {
          extractionId,
          documentId: extraction.documentId,
          approved,
          confirmedBy,
          notes,
          confidence: extraction.confidence,
        },
      })

      return {
        extractionId,
        status: approved ? 'promoted' : 'rejected',
        updatedAt: new Date(),
      }
    } catch (error) {
      logger.error('ConfirmExtraction contract failed', error as Error, { extractionId })
      throw error
    }
  }
}
