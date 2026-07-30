/**
 * Create Legal Issue Contract Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CreateLegalIssueOutputContract } from './create-legal-issue.contract'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

class FakeLegalIssuesRepository {
  async createIssue(data: any) {
    return {
      id: 'issue-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async getIssue(id: string) {
    return id === 'issue-1' ? { id, title: 'Test Issue' } : null
  }
}

class FakeMatterRepository {
  async getMatter(id: string) {
    return id === 'matter-1' ? { id, title: 'Test Matter' } : null
  }
}

class FakeEventPublisher {
  async publish(event: any) {
    return event
  }
}

describe('CreateLegalIssueOutputContract', () => {
  let contract: CreateLegalIssueOutputContract

  beforeEach(() => {
    contract = new CreateLegalIssueOutputContract(
      new FakeLegalIssuesRepository() as any,
      new FakeMatterRepository() as any,
      new FakeEventPublisher() as any,
    )
  })

  it('should create legal issue with valid input', async () => {
    const input = {
      matterId: 'matter-1',
      issueType: 'breach',
      title: 'Breach of Contract',
      description: 'The defendant failed to perform obligations',
      severity: 'high',
    }

    const result = await contract.execute(input)

    expect(result.id).toBe('issue-1')
    expect(result.matterId).toBe('matter-1')
    expect(result.title).toBe('Breach of Contract')
    expect(result.severity).toBe('high')
  })

  it('should reject missing title', async () => {
    const input = {
      matterId: 'matter-1',
      issueType: 'breach',
      description: 'The defendant failed to perform obligations',
      severity: 'high',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('should reject short description', async () => {
    const input = {
      matterId: 'matter-1',
      issueType: 'breach',
      title: 'Breach',
      description: 'Short',
      severity: 'high',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('should reject invalid matter reference', async () => {
    const input = {
      matterId: 'invalid-matter',
      issueType: 'breach',
      title: 'Breach of Contract',
      description: 'The defendant failed to perform obligations',
      severity: 'high',
    }

    await expect(contract.execute(input)).rejects.toThrow(NotFoundError)
  })

  it('should validate severity enum', async () => {
    const input = {
      matterId: 'matter-1',
      issueType: 'breach',
      title: 'Breach of Contract',
      description: 'The defendant failed to perform obligations',
      severity: 'invalid',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })
})
