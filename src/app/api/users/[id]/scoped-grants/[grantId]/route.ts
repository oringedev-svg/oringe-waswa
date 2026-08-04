import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; grantId: string }> }
) {
  const guard = await requirePermissionApi('manage_authorization')
  if ('response' in guard) return guard.response

  const { grantId } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase.from('permission_grants').select('*').eq('id', grantId).single()
  if (!existing) return NextResponse.json({ error: 'Grant not found' }, { status: 404 })

  const { error } = await supabase.from('permission_grants').delete().eq('id', grantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'permission_grants', record_id: grantId, action: 'DELETE', old_data: existing, performed_by: guard.profile.id })
  return NextResponse.json({ success: true })
}
