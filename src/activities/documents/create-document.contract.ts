/**
 * Create Document Output Contract
 *
 * User uploads a document to a matter.
 * Emits document_uploaded event (triggers Document Intelligence Engine).
 */

import { z } from 'zod'
import { PostgresDocumentsRepository } from '@/lib/repositories/DocumentsRepository'
import { MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { logger } from '@/lib/logging/logger'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'
import { getCurrentFirmId } from '@/lib/domainEvents'

const CreateDocumentInputSchema = z.object({
  matterId: z.string().uuid(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  documentType: z.enum(['complaint', 'motion', 'brief', 'order', 'contract', 'other']),
  uploadedBy: z.string().uuid(),
  fileUrl: z.string().url().optional(),
})

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>

export class CreateDocumentOutputContract {
  constructor(
    private documentsRepository: PostgresDocumentsRepository,
    private matterRepository: MatterRecordRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(input: unknown) {
    const validation = CreateDocumentInputSchema.safeParse(input)
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError(`Invalid document input: ${errors.join('; ')}`)
    }

    const { matterId, fileName, fileSize, documentType, uploadedBy, fileUrl } = validation.data

    try {
      logger.info('CreateDocument contract executing', { matterId, fileName })

      const matter = await this.matterRepository.getMatter(matterId)
      if (!matter) {
        throw new NotFoundError('Matter', matterId)
      }

      const document = await this.documentsRepository.createDocument({
        matterId,
        fileName,
        fileSize,
        documentType,
        uploadedBy,
        fileUrl,
      })

      await this.eventPublisher.publish({
        eventId: `document_uploaded_${document.id}_${Date.now()}`,
        type: 'document_uploaded',
        firmId: (await getCurrentFirmId())!,
        matterId: document.matterId,
        aggregateId: document.id,
        aggregateType: 'document',
        occurredAt: document.createdAt,
        payload: {
          documentId: document.id,
          matterId: document.matterId,
          fileName: document.fileName,
          documentType: document.documentType,
          uploadedBy: document.uploadedBy,
        },
      })

      logger.info('Document created and event emitted', { documentId: document.id })

      return {
        id: document.id,
        matterId: document.matterId,
        fileName: document.fileName,
        createdAt: document.createdAt,
      }
    } catch (error) {
      logger.error('CreateDocument contract failed', error as Error, { matterId, fileName })
      throw error
    }
  }
}
