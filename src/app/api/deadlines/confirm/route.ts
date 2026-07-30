/**
 * POST /api/deadlines/confirm
 *
 * Confirm and promote or reject proposed deadlines.
 * Input: { deadlineId, approved, confirmedBy, notes }
 * Output: { deadlineId, status, updatedAt }
 */

import { NextRequest, NextResponse } from 'next/server'
import { confirmDeadline } from '@/activities/deadline/ConfirmDeadlineActivity'

export async function POST(req: NextRequest) {
  return confirmDeadline(req)
}
