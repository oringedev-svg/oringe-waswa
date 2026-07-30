/**
 * Schedule Hearing Activity
 *
 * An Activity is a user-triggered piece of work.
 * It collects input from the UI (form submission)
 * and invokes an Output Contract to execute it.
 *
 * Activities NEVER touch the database directly.
 * Activities NEVER call Engines.
 * Activities call exactly ONE thing: their Output Contract's execute() method.
 */

import { ScheduleHearingOutputContract, ScheduleHearingInput } from './schedule-hearing.contract'
import { Hearing } from '@/lib/repositories/MatterRecordRepository'
import { logger } from '@/lib/logging/logger'

export interface ScheduleHearingActivityInput extends ScheduleHearingInput {
  // Activity-level metadata (separate from domain input)
  userId?: string
  firmId?: string
}

/**
 * Execute the Schedule Hearing activity.
 *
 * In the reference implementation (here), we assume the Composition Root
 * has already wired the contract. In a real deployment, this would be
 * injected via Next.js middleware or a service locator.
 */
export async function executeScheduleHearingActivity(
  input: ScheduleHearingActivityInput,
  contract: ScheduleHearingOutputContract,
): Promise<Hearing> {
  logger.info('ScheduleHearingActivity.execute() started', {
    matterId: input.matterId,
    userId: input.userId,
  })

  try {
    // The Activity layer has no logic.
    // It just passes validated input to the contract.
    const hearing = await contract.execute(input)

    logger.info('ScheduleHearingActivity.execute() succeeded', {
      hearingId: hearing.id,
      matterId: input.matterId,
    })

    return hearing
  } catch (err) {
    logger.error('ScheduleHearingActivity.execute() error', err as Error, {
      matterId: input.matterId,
      userId: input.userId,
    })
    throw err
  }
}
