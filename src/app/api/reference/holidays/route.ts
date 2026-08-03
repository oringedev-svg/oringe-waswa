import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile, requirePermissionApi } from '@/lib/auth'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { data, error } = await createAdminClient().from('public_holidays').select('*').eq('country_code', 'KE').order('month').order('day').order('name')
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ holidays: data || [] })
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_reference_data')
  if ('response' in guard) return guard.response
  const body = await req.json()
  if (!body.name || !body.calculation_rule || !body.holiday_type) return NextResponse.json({ error: 'name, holiday_type and calculation_rule are required' }, { status: 422 })
  const { data, error } = await createAdminClient().from('public_holidays').insert({ ...body, country_code: 'KE' }).select().single()
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_reference_data')
  if ('response' in guard) return guard.response
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 })
  const { data, error } = await createAdminClient().from('public_holidays').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('country_code', 'KE').select().single()
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json(data)
}

// Reference records are retained for auditability; delete means deactivate.
export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_reference_data')
  if ('response' in guard) return guard.response
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 422 })
  const { error } = await createAdminClient().from('public_holidays').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id).eq('country_code', 'KE')
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true })
}
