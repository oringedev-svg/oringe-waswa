/**
 * POST /api/document-extractions/confirm - Confirm document extraction
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresDocumentIntelligenceEngineRepository } from '@/lib/repositories/engines/DocumentIntelligenceEngineRepository'
import { ConfirmDocumentExtractionOutputContract } from '@/activities/documents/confirm-extraction.contract'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const repo = new PostgresDocumentIntelligenceEngineRepository(supabase)
    const container = getCompositionRoot()
    const contract = new ConfirmDocumentExtractionOutputContract(repo, container.eventPublisher || {})

    const result = await contract.execute(body)

    logger.info('Document extraction confirmed via API', { extractionId: body.extractionId })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('POST /api/document-extractions/confirm failed', error as Error)
    return NextResponse.json({ error: 'Failed to confirm extraction' }, { status: 500 })
  }
}
