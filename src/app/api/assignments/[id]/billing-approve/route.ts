import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, getSessionProfile } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('manage_billing')
  if ('response' in guard) return guard.response

  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = createAdminClient()

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  if (assignment.billing_status === 'NOT_PRICED') {
    return NextResponse.json(
      { error: 'Assignment has no estimated value. Add a billing reference first.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('assignments')
    .update({
      billing_status: 'APPROVED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'assignments',
    record_id: id,
    action: 'UPDATE',
    new_data: { billing_status: 'APPROVED', approved_by: profile.id },
  })

  return NextResponse.json(data)
}
