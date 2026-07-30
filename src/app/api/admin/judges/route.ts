/**
 * GET /api/admin/judges - List judges (optionally filtered by divisionId)
 * POST /api/admin/judges - Create a new judge
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresJudgesAdminRepository, Judge } from '@/lib/repositories/knowledge-hub/JudgesAdminRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const divisionId = searchParams.get('divisionId') || undefined

    const supabase = createAdminClient()
    const repo = new PostgresJudgesAdminRepository(supabase)

    let judges: Judge[]
    if (divisionId) {
      judges = await repo.getJudgesByDivisionId(divisionId)
    } else {
      judges = []
    }

    return NextResponse.json({
      success: true,
      data: judges,
      count: judges.length,
    })
  } catch (error) {
    logger.error('GET /api/admin/judges failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch judges' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresJudgesAdminRepository(supabase)
    const result = await repo.createJudge({
      divisionId: body.divisionId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      filingPreferences: body.filingPreferences,
    })

    logger.info('Judge created via API', {
      judgeId: result.id,
      fullName: result.fullName,
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 },
    )
  } catch (error) {
    logger.error('POST /api/admin/judges failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to create judge' },
      { status: 500 },
    )
  }
}
