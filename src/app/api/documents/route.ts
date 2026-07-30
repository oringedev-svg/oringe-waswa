/**
 * GET /api/documents - List documents
 * POST /api/documents - Upload document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCompositionRoot } from '@/lib/di/CompositionRoot'
import { logger } from '@/lib/logging/logger'
import { PostgresDocumentsRepository, Document } from '@/lib/repositories/DocumentsRepository'
import { PostgresMatterRecordRepository } from '@/lib/repositories/PostgresMatterRecordRepository'
import { CreateDocumentOutputContract } from '@/activities/documents/create-document.contract'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const matterId = searchParams.get('matterId')

    const supabase = createAdminClient()
    const repo = new PostgresDocumentsRepository(supabase)

    let documents: Document[]
    if (matterId) {
      documents = await repo.getDocumentsByMatter(matterId)
    } else {
      documents = []
    }

    return NextResponse.json({
      success: true,
      data: documents,
      count: documents.length,
    })
  } catch (error) {
    logger.error('GET /api/documents failed', error as Error)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const supabase = createAdminClient()
    const docsRepo = new PostgresDocumentsRepository(supabase)
    const matterRepo = new PostgresMatterRecordRepository(supabase)
    const container = getCompositionRoot()

    const contract = new CreateDocumentOutputContract(
      docsRepo,
      matterRepo,
      container.getEventPublisher(),
    )

    const result = await contract.execute(body)

    logger.info('Document uploaded via API', { documentId: result.id, matterId: body.matterId })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/documents failed', error as Error)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }
}
