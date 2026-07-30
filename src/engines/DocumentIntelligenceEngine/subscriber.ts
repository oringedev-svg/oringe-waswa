/**
 * Document Intelligence Engine Subscriber
 *
 * Subscribes to: document_uploaded
 * Processes: Document text extraction and analysis
 * Output: Stores proposed extractions (status: proposed)
 *
 * In production, this would use OCR/PDF parsing and NLP models.
 * For now, it's a placeholder that demonstrates the pattern.
 *
 * Rule: Engine NEVER writes to Matter Record directly.
 * Extractions only become facts via a "ConfirmDocumentExtraction" Activity.
 */

import { DomainEvent, EventBus } from '@/lib/event-bus/EventBus'
import { PostgresDocumentsRepository } from '@/lib/repositories/DocumentsRepository'
import { PostgresDocumentIntelligenceEngineRepository } from '@/lib/repositories/engines/DocumentIntelligenceEngineRepository'
import { logger } from '@/lib/logging/logger'

export class DocumentIntelligenceEngineSubscriber {
  constructor(
    private documentsRepository: PostgresDocumentsRepository,
    private intelligenceRepository: PostgresDocumentIntelligenceEngineRepository,
  ) {}

  subscribe(eventBus: EventBus): void {
    eventBus.subscribe('document_uploaded', (event) => this.handleDocumentUploaded(event))
    logger.info('DocumentIntelligenceEngine subscribed to events')
  }

  private async handleDocumentUploaded(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as any
      const matterId = payload.matterId
      const documentId = payload.documentId
      const fileName = payload.fileName

      logger.info('DocumentIntelligenceEngine handling document_uploaded', {
        matterId,
        documentId,
        fileName,
      })

      // In production, fetch the document and process it
      const document = await this.documentsRepository.getDocument(documentId)
      if (!document) {
        logger.warn('DocumentIntelligenceEngine: document not found', { documentId })
        return
      }

      // Simulate document processing
      // In production: would call OCR API, PDF parser, or NLP service
      const extractedText = `[Extracted text from ${document.fileName}]`
      const proposedCaseSummary = `Case summary extracted from ${document.documentType}`
      const proposedKeyDates = ['2026-08-15', '2026-09-01'] // Example dates
      const proposedParties = ['Party A', 'Party B'] // Example parties
      const proposedIssues = ['Contract Dispute', 'Breach of Agreement'] // Example issues
      const confidence = 75 // Simulated confidence score

      // Store proposed extraction
      await this.intelligenceRepository.saveExtraction({
        documentId,
        matterId,
        status: 'proposed',
        extractedText,
        proposedCaseSummary,
        proposedKeyDates,
        proposedParties,
        proposedIssues,
        confidence,
        sourceEvent: 'document_uploaded',
        computedAt: new Date(),
      })

      // Mark document as processed
      await this.documentsRepository.markDocumentProcessed(documentId)

      logger.info('DocumentIntelligenceEngine extraction created', {
        documentId,
        matterId,
        confidence,
      })
    } catch (err) {
      logger.error('DocumentIntelligenceEngine document_uploaded failed', err as Error, {
        eventId: event.eventId,
        matterId: event.matterId,
      })

      // Non-blocking: don't throw
    }
  }
}

/**
 * Factory function to create and subscribe a Document Intelligence Engine.
 */
export function createDocumentIntelligenceEngineSubscriber(
  documentsRepository: PostgresDocumentsRepository,
  intelligenceRepository: PostgresDocumentIntelligenceEngineRepository,
): DocumentIntelligenceEngineSubscriber {
  return new DocumentIntelligenceEngineSubscriber(documentsRepository, intelligenceRepository)
}
