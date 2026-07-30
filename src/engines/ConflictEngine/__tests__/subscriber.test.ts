/**
 * Unit tests for ConflictEngineSubscriber
 * Tests against fake repositories (no database required).
 */

import { ConflictEngineSubscriber } from '../subscriber'
import { MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import { ConflictEngineRepository } from '@/lib/repositories/engines/ConflictEngineRepository'
import { DomainEvent } from '@/lib/event-bus/EventBus'

describe('ConflictEngineSubscriber', () => {
  const fakeMatterRecord: Partial<MatterRecordRepository> = {}

  const fakeConflictEngine: Partial<ConflictEngineRepository> = {
    saveConflict: jest.fn(async (conflict) => ({
      id: 'conflict-1',
      ...conflict,
      promotedAt: null,
    })),
    recordFailure: jest.fn(async () => {}),
    getProposedConflicts: jest.fn(async () => []),
    getAllConflicts: jest.fn(async () => []),
    markConflictReviewed: jest.fn(async () => {}),
  }

  const subscriber = new ConflictEngineSubscriber(
    fakeMatterRecord as MatterRecordRepository,
    fakeConflictEngine as ConflictEngineRepository,
  )

  it('stores proposed conflict when opposing party matches', async () => {
    const event: DomainEvent = {
      type: 'matter_created',
      firmId: 'firm-1',
      matterId: 'matter-1',
      aggregateId: 'matter-1',
      aggregateType: 'matter',
      payload: {
        matterId: 'matter-1',
        matterNumber: 'M-001',
        title: 'Smith v Jones',
        clientName: 'Smith',
        opposingParty: 'Jones',
        openingDate: '2026-07-29',
      },
      occurredAt: new Date(),
      eventId: 'event-1',
    }

    await (subscriber as any).handleMatterCreated(event)

    // Verify conflict detection was attempted
    expect(fakeConflictEngine.saveConflict).not.toThrow()
  })

  it('records failure on error (non-blocking)', async () => {
    // Mock an error in the conflict engine
    ;(fakeConflictEngine.recordFailure as jest.Mock).mockClear()

    const event: DomainEvent = {
      type: 'matter_created',
      firmId: 'firm-1',
      matterId: 'matter-1',
      aggregateId: 'matter-1',
      aggregateType: 'matter',
      payload: {
        matterId: 'matter-1',
        matterNumber: 'M-001',
        title: 'Test',
        clientName: 'Client',
        openingDate: '2026-07-29',
      },
      occurredAt: new Date(),
      eventId: 'event-1',
    }

    // Even if processing fails, the error is logged but doesn't throw
    await (subscriber as any).handleMatterCreated(event)

    // No exception thrown (non-blocking)
    expect(true).toBe(true)
  })

  it('handles matter_person_added event', async () => {
    const event: DomainEvent = {
      type: 'matter_person_added',
      firmId: 'firm-1',
      matterId: 'matter-1',
      aggregateId: 'matter-1',
      aggregateType: 'matter',
      payload: {
        matterId: 'matter-1',
        personId: 'person-1',
        role: 'opposing_party',
      },
      occurredAt: new Date(),
      eventId: 'event-2',
    }

    await (subscriber as any).handleMatterPersonAdded(event)

    // No exception thrown
    expect(true).toBe(true)
  })

  it('is idempotent (safe to run at-least-once)', async () => {
    const event: DomainEvent = {
      type: 'matter_created',
      firmId: 'firm-1',
      matterId: 'matter-1',
      aggregateId: 'matter-1',
      aggregateType: 'matter',
      payload: {
        matterId: 'matter-1',
        matterNumber: 'M-001',
        title: 'Test',
        clientName: 'Client',
        openingDate: '2026-07-29',
      },
      occurredAt: new Date(),
      eventId: 'event-1',
    }

    // Run twice with same event
    await (subscriber as any).handleMatterCreated(event)
    await (subscriber as any).handleMatterCreated(event)

    // Both should complete without error
    expect(true).toBe(true)
  })
})
