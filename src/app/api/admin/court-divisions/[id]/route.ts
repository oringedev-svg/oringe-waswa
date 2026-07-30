/**
 * GET /api/admin/court-divisions/[id] - Get a specific division
 * PUT /api/admin/court-divisions/[id] - Update a division
 * DELETE /api/admin/court-divisions/[id] - Delete a division
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresCourtDivisionsAdminRepository } from '@/lib/repositories/knowledge-hub/CourtDivisionsAdminRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    const supabase = createAdminClient()
    const repo = new PostgresCourtDivisionsAdminRepository(supabase)
    const division = await repo.getDivision(id)

    if (!division) {
      return NextResponse.json(
        { error: 'Court division not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: division,
    })
  } catch (error) {
    logger.error('GET /api/admin/court-divisions/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch court division' },
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
    const repo = new PostgresCourtDivisionsAdminRepository(supabase)
    const result = await repo.updateDivision(id, body)

    logger.info('Court division updated via API', {
      divisionId: id,
      name: result.name,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('PUT /api/admin/court-divisions/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to update court division' },
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
    const repo = new PostgresCourtDivisionsAdminRepository(supabase)
    await repo.deleteDivision(id)

    logger.info('Court division deleted via API', {
      divisionId: id,
    })

    return NextResponse.json({
      success: true,
      data: { divisionId: id, deletedAt: new Date() },
    })
  } catch (error) {
    logger.error('DELETE /api/admin/court-divisions/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete court division' },
      { status: 500 },
    )
  }
}
