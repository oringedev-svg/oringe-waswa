/**
 * GET /api/admin/judges/[id] - Get a specific judge
 * PUT /api/admin/judges/[id] - Update a judge
 * DELETE /api/admin/judges/[id] - Delete a judge
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresJudgesAdminRepository } from '@/lib/repositories/knowledge-hub/JudgesAdminRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    const supabase = createAdminClient()
    const repo = new PostgresJudgesAdminRepository(supabase)
    const judge = await repo.getJudge(id)

    if (!judge) {
      return NextResponse.json(
        { error: 'Judge not found' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      data: judge,
    })
  } catch (error) {
    logger.error('GET /api/admin/judges/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch judge' },
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
    const repo = new PostgresJudgesAdminRepository(supabase)
    const result = await repo.updateJudge(id, body)

    logger.info('Judge updated via API', {
      judgeId: id,
      fullName: result.fullName,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error('PUT /api/admin/judges/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to update judge' },
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
    const repo = new PostgresJudgesAdminRepository(supabase)
    await repo.deleteJudge(id)

    logger.info('Judge deleted via API', {
      judgeId: id,
    })

    return NextResponse.json({
      success: true,
      data: { judgeId: id, deletedAt: new Date() },
    })
  } catch (error) {
    logger.error('DELETE /api/admin/judges/[id] failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to delete judge' },
      { status: 500 },
    )
  }
}
