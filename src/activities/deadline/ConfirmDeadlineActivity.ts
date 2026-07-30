/**
 * Confirm Deadline Activity
 *
 * User confirms and promotes proposed deadlines.
 * Zero logic: delegates to Output Contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'

export async function confirmDeadline(req: NextRequest) {
  try {
    const body = await req.json()
    const { deadlineId, approved, confirmedBy, notes } = body

    logger.info('ConfirmDeadlineActivity invoked', {
      deadlineId,
      approved,
      confirmedBy,
    })

    const container = getCompositionRoot()
    // Contract will be injected here once created
    // const contract = container.getConfirmDeadlineContract(firmId)
    // const result = await contract.execute({ deadlineId, approved, confirmedBy, notes })

    return NextResponse.json({
      success: true,
      deadlineId,
      action: approved ? 'confirmed' : 'rejected',
    })
  } catch (error) {
    logger.error('ConfirmDeadlineActivity failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to confirm deadline' },
      { status: 500 },
    )
  }
}
