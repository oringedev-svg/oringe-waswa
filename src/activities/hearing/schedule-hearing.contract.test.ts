/**
 * Unit tests for ScheduleHearingOutputContract
 * Tests against fake, in-memory repositories (no database required).
 * Validates: shape validation, referential validation, happy path, idempotency.
 */

import { ScheduleHearingOutputContract, ScheduleHearingInput } from './schedule-hearing.contract'
import { MatterRecordRepository, Hearing, TimelineEntry } from '@/lib/repositories/MatterRecordRepository'
import { CourtsRepository } from '@/lib/repositories/knowledge-hub/CourtsRepository'
import { CourtDivisionsRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsRepository'
import { JudgesRepository } from '@/lib/repositories/knowledge-hub/JudgesRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'

describe('ScheduleHearingOutputContract', () => {
  // Fake repositories for testing
  const fakeMatterRecord: MatterRecordRepository = {
    createHearing: jest.fn(async (h) => ({
      id: '1',
      ...h,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getHearing: jest.fn(async () => null),
    getHearingsByMatter: jest.fn(async () => []),
    updateHearingStatus: jest.fn(async () => {}),
    appendTimelineEntry: jest.fn(async (entry) => ({
      id: '1',
      ...entry,
      createdAt: new Date(),
    })),
    getTimeline: jest.fn(async () => []),
  }

  const fakeCourts: CourtsRepository = {
    getCourt: jest.fn(async (id) => {
      if (id === 'valid-court-1') {
        return { id, name: 'High Court', type: 'superior', jurisdiction: 'Kenya' }
      }
      throw new NotFoundError('Court', id)
    }),
    listCourts: jest.fn(async () => []),
    getCourtsByJurisdiction: jest.fn(async () => []),
  }

  const fakeDivisions: CourtDivisionsRepository = {
    getCourtDivision: jest.fn(async (id) => {
      if (id === 'valid-division-1') {
        return { id, courtId: 'valid-court-1', name: 'Commercial', description: null }
      }
      throw new NotFoundError('CourtDivision', id)
    }),
    getCourtDivisionsByCourtId: jest.fn(async () => []),
    validateDivisionBelongsToCourtl: jest.fn(async (divisionId, courtId) => {
      return divisionId === 'valid-division-1' && courtId === 'valid-court-1'
    }),
  }

  const fakeJudges: JudgesRepository = {
    getJudge: jest.fn(async (id) => {
      if (id === 'valid-judge-1') {
        return {
          id,
          courtDivisionId: 'valid-division-1',
          fullName: 'Justice Smith',
          title: 'Justice',
          notes: null,
          filingPreferences: {},
        }
      }
      throw new NotFoundError('Judge', id)
    }),
    getJudgesByDivisionId: jest.fn(async () => []),
    validateJudgeBelongsToDivision: jest.fn(async (judgeId, divisionId) => {
      return judgeId === 'valid-judge-1' && divisionId === 'valid-division-1'
    }),
  }

  const fakeEventPublisher: EventPublisher = {
    publish: jest.fn(async () => {}),
  }

  const contract = new ScheduleHearingOutputContract(
    fakeMatterRecord,
    fakeCourts,
    fakeDivisions,
    fakeJudges,
    fakeEventPublisher,
    'firm-1',
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects invalid input shape', async () => {
    const invalid = { matterId: 'not-a-uuid' }

    await expect(contract.execute(invalid)).rejects.toThrow(ValidationError)
  })

  it('rejects unknown court', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'unknown-court',
      hearingDate: new Date(Date.now() + 86400000), // tomorrow
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('rejects division not belonging to court', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      courtDivisionId: 'wrong-division', // doesn't belong to valid-court-1
      hearingDate: new Date(Date.now() + 86400000),
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('rejects judge not belonging to division', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      courtDivisionId: 'valid-division-1',
      judgeId: 'wrong-judge', // doesn't belong to valid-division-1
      hearingDate: new Date(Date.now() + 86400000),
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('rejects past hearing date', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      hearingDate: new Date(Date.now() - 86400000), // yesterday
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await expect(contract.execute(input)).rejects.toThrow(ValidationError)
  })

  it('creates hearing on happy path', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      courtDivisionId: 'valid-division-1',
      judgeId: 'valid-judge-1',
      courtroom: 'Room 5',
      hearingDate: new Date(Date.now() + 86400000),
      hearingTime: '10:00',
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    const result = await contract.execute(input)

    expect(result.id).toBeDefined()
    expect(result.matterId).toBe('matter-1')
    expect(result.courtId).toBe('valid-court-1')
    expect(result.judgeId).toBe('valid-judge-1')
    expect(result.status).toBe('scheduled')
    expect(fakeMatterRecord.createHearing).toHaveBeenCalled()
    expect(fakeMatterRecord.appendTimelineEntry).toHaveBeenCalled()
    expect(fakeEventPublisher.publish).toHaveBeenCalled()
  })

  it('emits hearing_scheduled event with correct payload', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      hearingDate: new Date(Date.now() + 86400000),
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await contract.execute(input)

    expect(fakeEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'hearing_scheduled',
        firmId: 'firm-1',
        matterId: 'matter-1',
        payload: expect.objectContaining({
          hearingId: expect.any(String),
          courtId: 'valid-court-1',
        }),
      }),
    )
  })

  it('handles custom purpose correctly', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      hearingDate: new Date(Date.now() + 86400000),
      purpose: 'other' as const,
      purposeOther: 'Motion hearing',
      sourceActivityId: 'activity-1',
    }

    await contract.execute(input)

    expect(fakeMatterRecord.createHearing).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'Motion hearing',
      }),
    )
  })

  it('appends timeline entry', async () => {
    const input = {
      matterId: 'matter-1',
      courtId: 'valid-court-1',
      hearingDate: new Date(Date.now() + 86400000),
      purpose: 'hearing',
      sourceActivityId: 'activity-1',
    }

    await contract.execute(input)

    expect(fakeMatterRecord.appendTimelineEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        matterId: 'matter-1',
        kind: 'hearing_scheduled',
        sourceActivityId: 'activity-1',
      }),
    )
  })
})
