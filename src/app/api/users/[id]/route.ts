import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const ROLES = ['admin', 'staff', 'moderator', 'client', 'public']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const body = await req.json()
  if (body.role !== undefined && !ROLES.includes(body.role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${ROLES.join(', ')}` }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    table_name: 'profiles',
    record_id: params.id,
    action: 'UPDATE',
    new_data: { role: body.role },
    performed_by: guard.profile.id,
  })

  return NextResponse.json(data)
}
