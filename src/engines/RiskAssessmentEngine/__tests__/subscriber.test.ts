/**
 * Risk Assessment Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RiskAssessmentEngineSubscriber } from '../subscriber'

class FakeLegalIssuesRepository {
  async getIssuesByMatter(matterId: string) {
    return [
      {
        id: 'issue-1',
        matterId,
        issueType: 'breach',
        title: 'Breach',
        description: 'Test',
        severity: 'high',
      },
      {
        id: 'issue-2',
        matterId,
        issueType: 'fraud',
        title: 'Fraud',
        description: 'Test',
        severity: 'critical',
      },
    ]
  }
}

class FakeRiskRepository {
  savedAssessment: any

  async saveRiskAssessment(data: any) {
    this.savedAssessment = data
    return { id: 'risk-1', ...data }
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

describe('RiskAssessmentEngineSubscriber', () => {
  let subscriber: RiskAssessmentEngineSubscriber
  let fakeRiskRepo: FakeRiskRepository
  let fakeEventBus: FakeEventBus

  beforeEach(() => {
    fakeRiskRepo = new FakeRiskRepository()
    subscriber = new RiskAssessmentEngineSubscriber(
      new FakeLegalIssuesRepository() as any,
      fakeRiskRepo as any,
    )
    fakeEventBus = new FakeEventBus() as any
  })

  it('should subscribe to legal_issue_created', () => {
    subscriber.subscribe(fakeEventBus as any)

    expect(fakeEventBus.handlers.has('legal_issue_created')).toBe(true)
  })

  it('should compute risk score from legal issues', async () => {
    subscriber.subscribe(fakeEventBus as any)

    await fakeEventBus.publish({
      eventId: 'evt-1',
      eventType: 'legal_issue_created',
      matterId: 'matter-1',
      payload: {
        matterId: 'matter-1',
        issueId: 'issue-1',
        severity: 'high',
      },
    })

    expect(fakeRiskRepo.savedAssessment).toBeDefined()
    expect(fakeRiskRepo.savedAssessment.status).toBe('proposed')
    expect(fakeRiskRepo.savedAssessment.riskScore).toBeGreaterThan(0)
    expect(fakeRiskRepo.savedAssessment.riskScore).toBeLessThanOrEqual(100)
  })

  it('should determine correct risk level', async () => {
    subscriber.subscribe(fakeEventBus as any)

    await fakeEventBus.publish({
      eventId: 'evt-1',
      eventType: 'legal_issue_created',
      matterId: 'matter-1',
      payload: { matterId: 'matter-1', issueId: 'issue-1', severity: 'high' },
    })

    expect(['low', 'medium', 'high', 'critical']).toContain(
      fakeRiskRepo.savedAssessment.riskLevel,
    )
  })

  it('should handle missing issues gracefully', async () => {
    const emptyRepo = new (class {
      async getIssuesByMatter() {
        return []
      }
    })()

    const emptySubscriber = new RiskAssessmentEngineSubscriber(
      emptyRepo as any,
      fakeRiskRepo as any,
    )
    emptySubscriber.subscribe(fakeEventBus as any)

    await expect(
      fakeEventBus.publish({
        eventId: 'evt-1',
        eventType: 'legal_issue_created',
        matterId: 'matter-1',
        payload: { matterId: 'matter-1', issueId: 'issue-1' },
      }),
    ).resolves.not.toThrow()
  })
})
