/**
 * GET /api/admin/courts/[id] - Get a specific court
 * PUT /api/admin/courts/[id] - Update a court
 * DELETE /api/admin/courts/[id] - Delete a court
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresCourtsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtsAdminRepository'
import { UpdateCourtOutputContract } from '@/activities/courts/update-court.contract'
import { DeleteCourtOutputContract } from '@/activities/courts/delete-court.contract'
import { createAdminClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    const supabase = createAdminClient()
    const repo = new PostgresCourtsAdminRepository(supabase)
    const court = await repo.getCourt(id)

    if (!court) {
      return NextResponse.json(
        { error: 'Court not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: court,
    })
  } catch (error) {
    logger.error('GET /api/admin/courts/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch court' },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresCourtsAdminRepository(supabase)
    const container = getCompositionRoot()
    const contract = new UpdateCourtOutputContract(repo, container.eventPublisher || {})

    const result = await contract.execute({
      courtId: id,
      updates: body,
    })

    logger.info('Court updated via API', {
      courtId: id,
      name: result.name,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('PUT /api/admin/courts/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to update court' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    const supabase = createAdminClient()
    const repo = new PostgresCourtsAdminRepository(supabase)
    const container = getCompositionRoot()
    const contract = new DeleteCourtOutputContract(repo, container.eventPublisher || {})

    const result = await contract.execute({ courtId: id })

    logger.info('Court deleted via API', {
      courtId: id,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('DELETE /api/admin/courts/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete court' },
      { status: 500 },
    )
  }
}
