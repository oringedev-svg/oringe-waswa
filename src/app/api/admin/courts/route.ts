/**
 * GET /api/admin/courts - List all courts
 * POST /api/admin/courts - Create a new court
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresCourtsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtsAdminRepository'
import { CreateCourtOutputContract } from '@/activities/courts/create-court.contract'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jurisdiction = searchParams.get('jurisdiction') || undefined

    const supabase = createAdminClient()
    const repo = new PostgresCourtsAdminRepository(supabase)
    const courts = await repo.listCourts(jurisdiction)

    return NextResponse.json({
      success: true,
      data: courts,
      count: courts.length,
    })
  } catch (error) {
    logger.error('GET /api/admin/courts failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch courts' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresCourtsAdminRepository(supabase)
    const container = getCompositionRoot()
    const contract = new CreateCourtOutputContract(repo, container.getEventPublisher())

    const result = await contract.execute(body)

    logger.info('Court created via API', {
      courtId: result.id,
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
    logger.error('POST /api/admin/courts failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to create court' },
      { status: 500 },
    )
  }
}
