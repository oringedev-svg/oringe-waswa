/**
 * GET /api/legal-issues/[id] - Get legal issue
 * PUT /api/legal-issues/[id] - Update legal issue
 * DELETE /api/legal-issues/[id] - Delete legal issue
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger'
import { PostgresLegalIssuesRepository } from '@/lib/repositories/LegalIssuesRepository'
import { createAdminClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createAdminClient()
    const repo = new PostgresLegalIssuesRepository(supabase)
    const issue = await repo.getIssue(params.id)

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: issue })
  } catch (error) {
    logger.error('GET /api/legal-issues/[id] failed', error as Error)
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const supabase = createAdminClient()
    const repo = new PostgresLegalIssuesRepository(supabase)
    const result = await repo.updateIssue(params.id, body)

    logger.info('Legal issue updated via API', { issueId: params.id })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.error('PUT /api/legal-issues/[id] failed', error as Error)
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createAdminClient()
    const repo = new PostgresLegalIssuesRepository(supabase)
    await repo.deleteIssue(params.id)

    logger.info('Legal issue deleted via API', { issueId: params.id })
    return NextResponse.json({ success: true, data: { issueId: params.id, deletedAt: new Date() } })
  } catch (error) {
    logger.error('DELETE /api/legal-issues/[id] failed', error as Error)
    return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 })
  }
}
