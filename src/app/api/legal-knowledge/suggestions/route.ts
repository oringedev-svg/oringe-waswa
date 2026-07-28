import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { resolveCourtGuidance } from '@/lib/courtRouting'

// The one endpoint the inline "Suggested Solutions" card actually calls,
// from both the matter page and the submission page. Given what's already
// known about the matter/submission (its type, and optionally a claim
// value and county), it returns the matched problems with their ranked
// solutions plus court/registry guidance, so the suggestion is automatic
// rather than requiring staff to go search a separate library page.
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const matterType = searchParams.get('matter_type')
  const q = searchParams.get('q')
  const claimValueParam = searchParams.get('claim_value')
  const claimValue = claimValueParam ? Number(claimValueParam) : null

  let query = supabase
    .from('problem_types')
    .select('*, solutions:problem_solutions(*)')
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  } else if (matterType) {
    query = query.eq('matter_type', matterType)
  } else {
    return NextResponse.json({ problems: [], court_guidance: null })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const problems = (data || []).map((p) => ({
    ...p,
    solutions: (p.solutions || []).slice().sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority),
  }))

  const courtGuidance = await resolveCourtGuidance(matterType, claimValue)

  return NextResponse.json({ problems, court_guidance: courtGuidance })
}
