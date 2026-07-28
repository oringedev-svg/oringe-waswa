import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth'
import { runConflictSearch } from '@/lib/conflictSearch'

// The standalone, pre-intake version of a conflict check, same search,
// same permission, but nothing to attach it to yet (no matter, no
// submission), so nothing is persisted. If it turns into a real
// instruction, the formal recorded check happens once an intake or matter
// exists (POST /api/conflict-checks), same as always.
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('run_conflict_check')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const query = (body.query as string || '').trim()
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

  const { results, highestRisk } = await runConflictSearch(query)
  return NextResponse.json({ results, highest_risk: highestRisk })
}
