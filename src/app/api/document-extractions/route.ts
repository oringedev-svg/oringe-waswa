/**
 * GET /api/document-extractions - List document extractions
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresDocumentIntelligenceEngineRepository } from '@/lib/repositories/engines/DocumentIntelligenceEngineRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const matterId = searchParams.get('matterId') || undefined
    const status = searchParams.get('status') || 'proposed'

    const supabase = createAdminClient()
    const repo = new PostgresDocumentIntelligenceEngineRepository(supabase)

    let extractions
    if (status === 'proposed') {
      extractions = await repo.getProposedExtractions(matterId)
    } else {
      extractions = await repo.getAllExtractions(matterId)
    }

    return NextResponse.json({
      success: true,
      data: extractions,
      count: extractions.length,
    })
  } catch (error) {
    logger.error('GET /api/document-extractions failed', error as Error)
    return NextResponse.json({ error: 'Failed to fetch document extractions' }, { status: 500 })
  }
}
