/**
 * GET /api/risk-assessments - List risk assessments
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresRiskAssessmentEngineRepository } from '@/lib/repositories/engines/RiskAssessmentEngineRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const matterId = searchParams.get('matterId') || undefined
    const status = searchParams.get('status') || 'proposed'

    const supabase = createAdminClient()
    const repo = new PostgresRiskAssessmentEngineRepository(supabase)

    let assessments
    if (status === 'proposed') {
      assessments = await repo.getProposedRiskAssessments(matterId)
    } else {
      assessments = await repo.getAllRiskAssessments(matterId)
    }

    return NextResponse.json({
      success: true,
      data: assessments,
      count: assessments.length,
    })
  } catch (error) {
    logger.error('GET /api/risk-assessments failed', error as Error)
    return NextResponse.json({ error: 'Failed to fetch risk assessments' }, { status: 500 })
  }
}
