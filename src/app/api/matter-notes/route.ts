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
    .from('matter_notes')
    .select('id, content, stage, created_at, author:profiles(full_name)')
    .eq('matter_id', matterId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const { matter_id, content } = await req.json()
  if (!matter_id || !content?.trim()) return NextResponse.json({ error: 'matter_id and content are required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: matter } = await supabase.from('legal_matters').select('status').eq('id', matter_id).single()
  if (!matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('matter_notes')
    .insert({ matter_id, content: content.trim(), stage: matter.status, author_id: guard.profile.id })
    .select('id, content, stage, created_at, author:profiles(full_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'matter_notes', record_id: data.id, action: 'INSERT', new_data: { matter_id } })
  return NextResponse.json(data, { status: 201 })
}
