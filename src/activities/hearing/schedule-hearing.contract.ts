/**
 * Schedule Hearing Output Contract - Reference Implementation
 *
 * This is the canonical example every future Activity's Output Contract should follow.
 * It demonstrates the complete feature lifecycle:
 *   Activity executes
 *     -> Output Contract validates input
 *     -> Output Contract is ONLY authorized to write Matter Record (via Repository)
 *     -> Domain Event emitted
 *     -> Engines react asynchronously (independent subscription)
 *     -> UI projects the resulting state (pure queries, no new tables)
 */

import { z } from 'zod'
import { Hearing, MatterRecordRepository } from '@/lib/repositories/MatterRecordRepository'
import {
  PostgresCountrRepository,
  CourtsRepository,
} from '@/lib/repositories/knowledge-hub/CourtsRepository'
import {
  PostgresCourtDivisionsRepository,
  CourtDivisionsRepository,
} from '@/lib/repositories/knowledge-hub/CourtDivisionsRepository'
import { PostgresJudgesRepository, JudgesRepository } from '@/lib/repositories/knowledge-hub/JudgesRepository'
import { EventPublisher } from '@/lib/repositories/EventPublisher'
import { DomainEvent } from '@/lib/event-bus/EventBus'
import { ValidationError, NotFoundError } from '@/lib/errors/DomainError'
import { logger } from '@/lib/logging/logger'

/**
 * Step 1: INPUT SCHEMA
 * What this Activity collects, and comprehensive validation.
 * No untyped payloads reach the write layer.
 */
export const ScheduleHearingInput = z.object({
  matterId: z.string().uuid('Must be a valid matter ID'),

  // Knowledge Hub references, IDs only, never denormalized names/labels
  courtId: z.string().uuid('Must be a valid court ID'),
  courtDivisionId: z.string().uuid('Must be a valid court division ID').optional(),
  judgeId: z.string().uuid('Must be a valid judge ID').optional(),
  courtroom: z.string().max(100, 'Courtroom name too long').optional(),

  hearingDate: z.coerce.date('Invalid date'),
  hearingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM')
    .optional(),
  purpose: z.enum(['mention', 'hearing', 'ruling', 'pre_trial_conference', 'taxation', 'other'], {
    errorMap: () => ({ message: 'Invalid hearing purpose' }),
  }),
  purposeOther: z.string().max(200, 'Purpose description too long').optional(),

  // Provenance: which Activity instance produced this write
  sourceActivityId: z.string().uuid('Must be a valid activity ID'),
})
  .refine((v) => v.purpose !== 'other' || !!v.purposeOther, {
    message: 'purposeOther is required when purpose = "other"',
    path: ['purposeOther'],
  })
  .refine((v) => !v.judgeId || !!v.courtDivisionId, {
    message: 'courtDivisionId is required when judgeId is supplied',
    path: ['courtDivisionId'],
  })
  .refine((v) => v.hearingDate > new Date(), {
    message: 'Hearing date must be in the future',
    path: ['hearingDate'],
  })

export type ScheduleHearingInput = z.infer<typeof ScheduleHearingInput>

/**
 * Step 2: MATTER RECORD ENTITY
 * The Activity only knows "I produce a Hearing."
 * It has no idea this maps to a database table.
 */
export { Hearing }

/**
 * Step 3: DEPENDENCY INJECTION
 * The contract depends on Repository INTERFACES, injected at construction.
 * Never imports a concrete DB client, ORM model, or another contract.
 */

/**
 * Step 4: THE OUTPUT CONTRACT
 * Single `execute()` method handles:
 *  - Validation (shape + referential)
 *  - Matter Record writes (via Repository)
 *  - Transaction boundary (atomic all-or-nothing)
 *  - Domain event emission (after commit, never before)
 *  - Error handling (domain-level errors, not raw DB errors)
 */
export class ScheduleHearingOutputContract {
  constructor(
    private readonly matterRecord: MatterRecordRepository,
    private readonly courtsHub: CourtsRepository,
    private readonly divisionsHub: CourtDivisionsRepository,
    private readonly judgesHub: JudgesRepository,
    private readonly events: EventPublisher,
    private readonly firmId: string,
  ) {}

  async execute(rawInput: unknown): Promise<Hearing> {
    logger.info('ScheduleHearingOutputContract.execute() started', {
      sourceActivityId: (rawInput as any)?.sourceActivityId,
    })

    // Step 1: Validate shape
    let input: ScheduleHearingInput
    try {
      input = ScheduleHearingInput.parse(rawInput)
    } catch (err: any) {
      const error = new ValidationError(err.errors?.[0]?.message || 'Invalid input', 'input')
      logger.error('Input validation failed', error, { rawInput })
      throw error
    }

    // Step 2: Validate + resolve Knowledge Hub references
    // This is where "judge dropdown must filter by division" is enforced server-side.
    let court
    try {
      court = await this.courtsHub.getCourt(input.courtId)
    } catch (err) {
      const error = new ValidationError(`Court not found: ${input.courtId}`, 'courtId')
      logger.error('Court lookup failed', error, { courtId: input.courtId })
      throw error
    }

    if (input.courtDivisionId) {
      let division
      try {
        division = await this.divisionsHub.getCourtDivision(input.courtDivisionId)
      } catch (err) {
        const error = new ValidationError(`Court division not found: ${input.courtDivisionId}`, 'courtDivisionId')
        logger.error('Division lookup failed', error, { courtDivisionId: input.courtDivisionId })
        throw error
      }

      if (division.courtId !== input.courtId) {
        const error = new ValidationError(
          'Court division does not belong to the specified court',
          'courtDivisionId',
        )
        logger.error('Division/court mismatch', error, {
          divisionCourtId: division.courtId,
          inputCourtId: input.courtId,
        })
        throw error
      }
    }

    if (input.judgeId) {
      let judge
      try {
        judge = await this.judgesHub.getJudge(input.judgeId)
      } catch (err) {
        const error = new ValidationError(`Judge not found: ${input.judgeId}`, 'judgeId')
        logger.error('Judge lookup failed', error, { judgeId: input.judgeId })
        throw error
      }

      if (!input.courtDivisionId || judge.courtDivisionId !== input.courtDivisionId) {
        const error = new ValidationError('Judge does not belong to the specified division', 'judgeId')
        logger.error('Judge/division mismatch', error, {
          judgeCourtDivisionId: judge.courtDivisionId,
          inputCourtDivisionId: input.courtDivisionId,
        })
        throw error
      }
    }

    // Step 3: Write to Matter Record (ONLY authorized write path)
    // This is atomic at the Repository layer.
    let hearing: Hearing
    try {
      hearing = await this.matterRecord.createHearing({
        matterId: input.matterId,
        courtId: input.courtId,
        courtDivisionId: input.courtDivisionId ?? null,
        judgeId: input.judgeId ?? null,
        courtroom: input.courtroom ?? null,
        hearingDate: input.hearingDate,
        hearingTime: input.hearingTime ?? null,
        purpose: input.purpose === 'other' ? input.purposeOther! : input.purpose,
        status: 'scheduled',
        sourceActivityId: input.sourceActivityId,
      })
    } catch (err) {
      logger.error('Hearing creation failed', err as Error, {
        matterId: input.matterId,
        sourceActivityId: input.sourceActivityId,
      })
      throw err
    }

    // Step 4: Append to Timeline (also a Matter Record write, part of same transaction)
    try {
      await this.matterRecord.appendTimelineEntry({
        matterId: input.matterId,
        kind: 'hearing_scheduled',
        summary: `Hearing scheduled for ${input.hearingDate.toDateString()} at court`,
        refId: hearing.id,
        sourceActivityId: input.sourceActivityId,
      })
    } catch (err) {
      logger.error('Timeline append failed', err as Error, {
        matterId: input.matterId,
        hearingId: hearing.id,
      })
      throw err
    }

    // Step 5: Emit domain event
    // CRITICAL: Only after writes commit. Engines subscribe independently.
    try {
      await this.events.publish({
        type: 'hearing_scheduled',
        firmId: this.firmId,
        matterId: input.matterId,
        aggregateId: hearing.id,
        aggregateType: 'hearing',
        payload: {
          hearingId: hearing.id,
          hearingDate: hearing.hearingDate.toISOString(),
          hearingTime: hearing.hearingTime,
          courtId: hearing.courtId,
          courtDivisionId: hearing.courtDivisionId,
          judgeId: hearing.judgeId,
          purpose: hearing.purpose,
        },
        occurredAt: new Date(),
      })
    } catch (err) {
      // Log but don't throw; event publication failure should not block Activity completion
      logger.error('Event publication failed (non-blocking)', err as Error, {
        hearingId: hearing.id,
        matterId: input.matterId,
      })
    }

    logger.info('ScheduleHearingOutputContract.execute() succeeded', {
      hearingId: hearing.id,
      matterId: input.matterId,
      sourceActivityId: input.sourceActivityId,
    })

    return hearing
  }
}
