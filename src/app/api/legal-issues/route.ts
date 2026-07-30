/**
 * POST /api/legal-issues - Create a new legal issue for a matter
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { PostgresMatterRecordRepository } from '@/lib/repositories/PostgresMatterRecordRepository'
import { CreateLegalIssueOutputContract } from '@/activities/legal-issues/create-legal-issue.contract'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const issuesRepo = new PostgresLegalIssuesRepository(supabase)
    const matterRepo = new PostgresMatterRecordRepository(supabase)
    const container = getCompositionRoot()

    const contract = new CreateLegalIssueOutputContract(
      issuesRepo,
      matterRepo,
      container.eventPublisher || {},
    )

    const result = await contract.execute(body)

    logger.info('Legal issue created via API', {
      issueId: result.id,
      matterId: result.matterId,
      title: result.title,
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 },
    )
  } catch (error) {
    logger.error('POST /api/legal-issues failed', error as Error)
    return NextResponse.json(
      { error: 'Failed to create legal issue' },
      { status: 500 },
    )
  }
}
