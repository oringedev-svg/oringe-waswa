import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Hard delete, not soft, this only removes non-active instruments (a
// failed/draft import, or an intentionally superseded archived version).
// Schedules/rules/bands/conditions/explanations cascade with it;
// matter_fees.rule_id is ON DELETE SET NULL so accepted fees keep their
// own snapshot even if the source rule is later removed.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_fee_schedules')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: instrument } = await supabase.from('legal_instruments').select('status').eq('id', params.id).single()
  if (!instrument) return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
  if (instrument.status === 'active') {
    return NextResponse.json({ error: 'Cannot delete an active instrument, import a new version to replace it first' }, { status: 400 })
  }

  const { error } = await supabase.from('legal_instruments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'legal_instruments', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
