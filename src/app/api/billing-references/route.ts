import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('manage_billing_references')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const active = searchParams.get('active')

  let query = supabase
    .from('billing_references')
    .select('*', { count: 'exact' })
    .order('work_type')

  if (active === 'true') query = query.eq('active', true)
  if (active === 'false') query = query.eq('active', false)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_billing_references')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  const {
    work_type,
    billing_method,
    default_value,
    currency = 'KES',
    vat_profile = 'standard',
    tax_profile,
    estimated_hours,
    estimated_duration_label,
    default_template_id,
    notes,
  } = body

  if (!work_type || !billing_method) {
    return NextResponse.json(
      { error: 'work_type and billing_method are required' },
      { status: 400 }
    )
  }

  if (!['Fixed', 'Hourly', 'Unit', 'Percentage', 'Custom'].includes(billing_method)) {
    return NextResponse.json(
      { error: 'Invalid billing_method' },
      { status: 400 }
    )
  }

  const { data: firm } = await supabase
    .from('firms')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (!firm) {
    return NextResponse.json({ error: 'No firm found' }, { status: 404 })
  }

  const { data: reference, error } = await supabase
    .from('billing_references')
    .insert({
      firm_id: firm.id,
      work_type,
      billing_method,
      default_value: default_value || 0,
      currency,
      vat_profile,
      tax_profile: tax_profile || null,
      estimated_hours: estimated_hours || null,
      estimated_duration_label: estimated_duration_label || null,
      default_template_id: default_template_id || null,
      notes: notes || null,
      created_by: guard.profile.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A billing reference with work type "${work_type}" already exists` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'billing_references',
    record_id: reference.id,
    action: 'INSERT',
    new_data: { work_type, billing_method, default_value },
  })

  return NextResponse.json(reference, { status: 201 })
}
