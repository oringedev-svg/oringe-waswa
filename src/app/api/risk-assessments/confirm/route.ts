/**
 * POST /api/risk-assessments/confirm - Confirm risk assessment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresRiskAssessmentEngineRepository } from '@/lib/repositories/engines/RiskAssessmentEngineRepository'
import { ConfirmRiskOutputContract } from '@/activities/risk-assessment/confirm-risk.contract'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresRiskAssessmentEngineRepository(supabase)
    const container = getCompositionRoot()
    const contract = new ConfirmRiskOutputContract(repo, container.getEventPublisher())

    const result = await contract.execute(body)

    logger.info('Risk assessment confirmed via API', { assessmentId: body.assessmentId })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('POST /api/risk-assessments/confirm failed', error as Error)
    return NextResponse.json({ error: 'Failed to confirm risk assessment' }, { status: 500 })
  }
}
