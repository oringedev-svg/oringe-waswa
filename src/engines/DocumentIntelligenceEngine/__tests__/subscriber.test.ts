/**
 * Document Intelligence Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DocumentIntelligenceEngineSubscriber } from '../subscriber'

class FakeDocumentsRepository {
  async getDocument(id: string) {
    return id === 'doc-1'
      ? {
          id,
          matterId: 'matter-1',
          fileName: 'contract.pdf',
          fileSize: 1024,
          documentType: 'contract',
          uploadedBy: 'user-1',
        }
      : null
  }

  async markDocumentProcessed(id: string) {
    return true
  }
}

class FakeIntelligenceRepository {
  savedExtraction: any

  async saveExtraction(data: any) {
    this.savedExtraction = data
    return { id: 'extr-1', ...data }
  }
}

class FakeEventBus {
  handlers: Map<string, Function[]> = new Map()

  subscribe(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }

  async publish(event: any) {
    const handlers = this.handlers.get(event.eventType) || []
    for (const handler of handlers) {
      await handler(event)
    }
  }
}

describe('DocumentIntelligenceEngineSubscriber', () => {
  let subscriber: DocumentIntelligenceEngineSubscriber
  let fakeIntelRepo: FakeIntelligenceRepository
  let fakeEventBus: FakeEventBus

  beforeEach(() => {
    fakeIntelRepo = new FakeIntelligenceRepository()
    subscriber = new DocumentIntelligenceEngineSubscriber(
      new FakeDocumentsRepository() as any,
      fakeIntelRepo as any,
    )
    fakeEventBus = new FakeEventBus() as any
  })

  it('should subscribe to document_uploaded', () => {
    subscriber.subscribe(fakeEventBus as any)

    expect(fakeEventBus.handlers.has('document_uploaded')).toBe(true)
  })

  it('should extract text and create proposal', async () => {
    subscriber.subscribe(fakeEventBus as any)

    await fakeEventBus.publish({
      eventId: 'evt-1',
      eventType: 'document_uploaded',
      matterId: 'matter-1',
      payload: {
        matterId: 'matter-1',
        documentId: 'doc-1',
        fileName: 'contract.pdf',
      },
    })

    expect(fakeIntelRepo.savedExtraction).toBeDefined()
    expect(fakeIntelRepo.savedExtraction.status).toBe('proposed')
    expect(fakeIntelRepo.savedExtraction.extractedText).toBeDefined()
  })

  it('should include confidence score', async () => {
    subscriber.subscribe(fakeEventBus as any)

    await fakeEventBus.publish({
      eventId: 'evt-1',
      eventType: 'document_uploaded',
      matterId: 'matter-1',
      payload: {
        matterId: 'matter-1',
        documentId: 'doc-1',
        fileName: 'contract.pdf',
      },
    })

    expect(fakeIntelRepo.savedExtraction.confidence).toBeGreaterThanOrEqual(0)
    expect(fakeIntelRepo.savedExtraction.confidence).toBeLessThanOrEqual(100)
  })

  it('should handle missing document gracefully', async () => {
    subscriber.subscribe(fakeEventBus as any)

    await expect(
      fakeEventBus.publish({
        eventId: 'evt-1',
        eventType: 'document_uploaded',
        matterId: 'matter-1',
        payload: {
          matterId: 'matter-1',
          documentId: 'invalid-doc',
          fileName: 'unknown.pdf',
        },
      }),
    ).resolves.not.toThrow()
  })
})
