/**
 * POST /api/hearings/schedule
 * Schedule a hearing on a matter.
 *
 * Invokes the ScheduleHearingOutputContract, which:
 *  1. Validates input shape and Knowledge Hub references
 *  2. Writes to Matter Record (atomic)
 *  3. Emits domain event for Engines to react to
 *  4. Returns the created hearing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { ValidationError } from '@/lib/errors/DomainError'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const firm = 'oringe-waswa' // In production, derive from authenticated user

    logger.info('POST /api/hearings/schedule', {
      matterId: body.matterId,
      firm,
    })

    // Get the contract from the composition root
    const container = getCompositionRoot()
    const contract = container.getScheduleHearingContract(firm)

    // Invoke the Output Contract
    const hearing = await contract.execute({
      ...body,
      sourceActivityId: body.sourceActivityId || uuidv4(),
    })

    const duration = Date.now() - startTime
    logger.info('POST /api/hearings/schedule succeeded', {
      hearingId: hearing.id,
      matterId: hearing.matterId,
      duration,
    })

    return NextResponse.json(hearing, { status: 201 })
  } catch (err) {
    const duration = Date.now() - startTime

    if (err instanceof ValidationError) {
      logger.warn('POST /api/hearings/schedule validation failed', {
        field: err.field,
        message: err.message,
        duration,
      })
      return NextResponse.json(
        {
          error: 'Validation failed',
          field: err.field,
          message: err.message,
        },
        { status: 400 },
      )
    }

    logger.error('POST /api/hearings/schedule error', err as Error, { duration })
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to schedule hearing',
      },
      { status: 500 },
    )
  }
}
