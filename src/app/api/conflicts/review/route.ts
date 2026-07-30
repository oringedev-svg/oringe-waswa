/**
 * POST /api/conflicts/review
 *
 * Review and promote or reject proposed conflicts.
 * Input: { conflictId, approved, reviewedBy, notes }
 * Output: { conflictId, status, updatedAt }
 */

import { NextRequest, NextResponse } from 'next/server'
import { reviewConflict } from '@/activities/conflict/ReviewConflictActivity'

export async function POST(req: NextRequest) {
  return reviewConflict(req)
}
