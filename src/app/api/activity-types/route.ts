import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('manage_operations')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const active = searchParams.get('active')

  let query = supabase
    .from('activity_types')
    .select('*, billing_reference:billing_references(id, work_type, billing_method, default_value)', { count: 'exact' })
    .order('name')

  if (active === 'true') query = query.eq('is_active', true)
  if (active === 'false') query = query.eq('is_active', false)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_operations')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  const {
    activity_key,
    name,
    category = 'legal_work',
    description,
    default_due_days,
    billing_reference_id,
  } = body

  if (!activity_key || !name) {
    return NextResponse.json(
      { error: 'activity_key and name are required' },
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

  const { data: activity, error } = await supabase
    .from('activity_types')
    .insert({
      firm_id: firm.id,
      activity_key: activity_key.toUpperCase().replace(/\s+/g, '_'),
      name,
      category,
      description: description || null,
      default_due_days: default_due_days || null,
      billing_reference_id: billing_reference_id || null,
    })
    .select('*, billing_reference:billing_references(id, work_type)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An activity type with this key already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    table_name: 'activity_types',
    record_id: activity.id,
    action: 'INSERT',
    new_data: { name, activity_key: activity.activity_key, billing_reference_id },
  })

  return NextResponse.json(activity, { status: 201 })
}
