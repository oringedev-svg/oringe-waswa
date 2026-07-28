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
    .from('matter_fees')
    .select('*, creator:profiles(full_name)')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matter_costs')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const { matter_id, category, name, amount } = body
  if (!matter_id || !category || !name?.trim() || typeof amount !== 'number') {
    return NextResponse.json({ error: 'matter_id, category, name, and a numeric amount are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('matter_fees')
    .insert({
      matter_id,
      rule_id: body.rule_id || null,
      category,
      name: name.trim(),
      amount,
      vat_applicable: body.vat_applicable || false,
      vat_amount: body.vat_amount || 0,
      recoverable: body.recoverable || null,
      explanation: body.explanation || null,
      created_by: guard.profile.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({ table_name: 'matter_fees', record_id: data.id, action: 'INSERT', new_data: { matter_id, category, name, amount } })
  try {
    await supabase.from('cost_history').insert({ matter_id, matter_fee_id: data.id, old_amount: null, new_amount: amount, reason: 'Fee added', trigger: 'created', actor_id: guard.profile.id })
  } catch {}

  return NextResponse.json(data, { status: 201 })
}
