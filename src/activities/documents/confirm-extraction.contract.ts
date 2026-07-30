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
import { getCurrentFirmId } from '@/lib/domainEvents'

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
      throw new ValidationError(`Invalid extraction confirmation input: ${errors.join('; ')}`)
    }

    const { extractionId, approved, confirmedBy, notes } = validation.data

    try {
      logger.info('ConfirmExtraction contract executing', { extractionId, approved })

      const allExtractions = await this.intelligenceRepository.getAllExtractions()
      const extraction = allExtractions.find((e) => e.id === extractionId)

      if (!extraction) {
        throw new NotFoundError('Document extraction', extractionId)
      }

      if (approved) {
        await this.intelligenceRepository.promoteExtraction(extractionId, confirmedBy)
      } else {
        await this.intelligenceRepository.rejectExtraction(extractionId, confirmedBy)
      }

      const updatedAt = new Date()
      await this.eventPublisher.publish({
        eventId: `extraction_confirmed_${extractionId}_${Date.now()}`,
        type: 'extraction_confirmed',
        firmId: (await getCurrentFirmId())!,
        matterId: extraction.matterId,
        aggregateId: extractionId,
        aggregateType: 'document_extraction',
        occurredAt: updatedAt,
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
        updatedAt,
      }
    } catch (error) {
      logger.error('ConfirmExtraction contract failed', error as Error, { extractionId })
      throw error
    }
  }
}
