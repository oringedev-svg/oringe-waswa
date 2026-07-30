/**
 * GET /api/admin/court-divisions - List divisions (optionally filtered by courtId)
 * POST /api/admin/court-divisions - Create a new division
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { CreateCourtDivisionOutputContract } from '@/activities/court-divisions/create-division.contract'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const courtId = searchParams.get('courtId') || undefined

    const supabase = createAdminClient()
    const repo = new PostgresCourtDivisionsAdminRepository(supabase)

    let divisions
    if (courtId) {
      divisions = await repo.getDivisionsByCourtId(courtId)
    } else {
      // Get all divisions (would need to implement getAllDivisions)
      divisions = []
    }

    return NextResponse.json({
      success: true,
      data: divisions,
      count: divisions.length,
    })
  } catch (error) {
    logger.error('GET /api/admin/court-divisions failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch court divisions' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresCourtDivisionsAdminRepository(supabase)
    const container = getCompositionRoot()
    const contract = new CreateCourtDivisionOutputContract(repo, container.eventPublisher || {})

    const result = await contract.execute(body)

    logger.info('Court division created via API', {
      divisionId: result.id,
      courtId: result.courtId,
      name: result.name,
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 },
    )
  } catch (error) {
    logger.error('POST /api/admin/court-divisions failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to create court division' },
      { status: 500 },
    )
  }
}
