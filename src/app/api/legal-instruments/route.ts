import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const trash = searchParams.get('trash') === 'true'

  let query = supabase
    .from('legal_instruments')
    .select('*, schedules:fee_schedules(id, number, title, rules:fee_rules(id, paragraph, name, calculation_type, minimum, maximum, fixed_amount, unit_rate, currency, bands:fee_rule_bands(*), conditions:fee_rule_conditions(*), explanations:fee_rule_explanations(*)))')
    .order('created_at', { ascending: false })
  query = trash ? query.eq('status', 'archived') : query.neq('status', 'archived')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
