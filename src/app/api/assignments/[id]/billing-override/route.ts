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
  const { override_value, override_reason } = await req.json()
  const supabase = createAdminClient()

  if (!override_value && override_value !== 0) {
    return NextResponse.json({ error: 'override_value is required' }, { status: 400 })
  }

  if (!override_reason || !override_reason.trim()) {
    return NextResponse.json({ error: 'override_reason is required' }, { status: 400 })
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  if (!assignment.billing_reference_id) {
    return NextResponse.json(
      { error: 'Assignment has no billing reference. Cannot apply override.' },
      { status: 400 }
    )
  }

  // Create the override record
  const { data: override, error: overrideError } = await supabase
    .from('billing_overrides')
    .insert({
      assignment_id: id,
      billing_reference_id: assignment.billing_reference_id,
      reference_value: assignment.estimated_value,
      override_value: Number(override_value),
      override_reason: override_reason.trim(),
      created_by: profile.id,
    })
    .select()
    .single()

  if (overrideError) {
    return NextResponse.json({ error: overrideError.message }, { status: 500 })
  }

  // Update the assignment with the new value
  const { data: updated, error: updateError } = await supabase
    .from('assignments')
    .update({
      estimated_value: Number(override_value),
      billing_status: 'PRICED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'billing_overrides',
    record_id: override.id,
    action: 'INSERT',
    new_data: { assignment_id: id, override_value, override_reason: override_reason.trim() },
  })

  return NextResponse.json({ override, assignment: updated })
}
