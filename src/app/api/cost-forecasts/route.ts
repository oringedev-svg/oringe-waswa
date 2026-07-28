import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  if (!matterId) return NextResponse.json({ error: 'matter_id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cost_forecasts')
    .select('*')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matter_costs')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const { matter_id, stage_label, expected_cost } = body
  if (!matter_id || !stage_label?.trim() || typeof expected_cost !== 'number') {
    return NextResponse.json({ error: 'matter_id, stage_label, and a numeric expected_cost are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cost_forecasts')
    .insert({ matter_id, stage_label: stage_label.trim(), expected_cost, confidence: body.confidence || null, created_by: guard.profile.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'cost_forecasts', record_id: data.id, action: 'INSERT', new_data: { matter_id, stage_label, expected_cost } })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matter_costs')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('cost_forecasts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'cost_forecasts', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
