/**
 * Review Conflict Activity
 *
 * User reviews and either promotes or rejects proposed conflicts.
 * Zero logic: delegates to Output Contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'

export async function reviewConflict(req: NextRequest) {
  try {
    const body = await req.json()
    const { conflictId, approved, reviewedBy, notes } = body

    logger.info('ReviewConflictActivity invoked', {
      conflictId,
      approved,
      reviewedBy,
    })

    const container = getCompositionRoot()
    // Contract will be injected here once created
    // const contract = container.getReviewConflictContract(firmId)
    // const result = await contract.execute({ conflictId, approved, reviewedBy, notes })

    return NextResponse.json({
      success: true,
      conflictId,
      action: approved ? 'promoted' : 'rejected',
    })
  } catch (error) {
    logger.error('ReviewConflictActivity failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to review conflict' },
      { status: 500 },
    )
  }
}
