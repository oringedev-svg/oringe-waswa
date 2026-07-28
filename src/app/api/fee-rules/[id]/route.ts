import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const EDITABLE_FIELDS = ['minimum', 'maximum', 'fixed_amount', 'unit_rate'] as const

// Quick-correction path for a single rule, without a full re-import, the
// JSON import is the primary way rules get entered, this just covers
// fixing one figure (e.g. a corrected minimum) in place.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_fee_schedules')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: `No editable fields provided (${EDITABLE_FIELDS.join(', ')})` }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('fee_rules').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'fee_rules', record_id: params.id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}
