import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'
import { resolveApplicableFees, type MatterForCosting } from '@/lib/costEngine'

// The "intelligent suggestion" endpoint for costs, given a matter, returns
// every applicable fee rule from the active legal instrument(s) along with
// its computed amount and full explanation. Mirrors
// /api/legal-knowledge/suggestions's shape for the same reason: automatic,
// inline, no separate tool to go find.
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  const type = searchParams.get('type')

  let costing: MatterForCosting
  if (matterId) {
    const supabase = createAdminClient()
    // claim_value/county (migration 018) may not exist yet on some
    // deployments, fall back to the select that always worked.
    let matter: { type: string; claim_value?: number | null; county?: string | null } | null
    ;({ data: matter } = await supabase.from('legal_matters').select('type, claim_value, county').eq('id', matterId).single())
    if (!matter) {
      ;({ data: matter } = await supabase.from('legal_matters').select('type').eq('id', matterId).single())
    }
    if (!matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
    costing = { type: matter.type, claim_value: matter.claim_value ?? null, county: matter.county ?? null }
  } else if (type) {
    // Ad-hoc quote for a prospective client, no matter exists yet, just
    // the raw inputs a standalone calculator would collect.
    const claimValueRaw = searchParams.get('claim_value')
    costing = {
      type,
      claim_value: claimValueRaw ? Number(claimValueRaw) : null,
      county: searchParams.get('county') || null,
    }
  } else {
    return NextResponse.json({ error: 'matter_id or type is required' }, { status: 400 })
  }

  const resolved = await resolveApplicableFees(costing)
  return NextResponse.json(resolved)
}
