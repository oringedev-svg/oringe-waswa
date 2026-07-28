import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi, requireAdminApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const matterId = searchParams.get('matter_id')
  if (!matterId) return NextResponse.json({ error: 'matter_id is required' }, { status: 400 })

  let query = supabase
    .from('time_entries')
    .select('*, author:profiles(full_name)')
    .eq('matter_id', matterId)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (searchParams.get('unbilled') === 'true') query = query.is('invoice_id', null).eq('billable', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('log_time')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const { matter_id, description, entry_date, minutes, rate, billable } = body
  if (!matter_id || !description || !minutes) {
    return NextResponse.json({ error: 'matter_id, description, and minutes are required' }, { status: 400 })
  }
  if (minutes <= 0) return NextResponse.json({ error: 'minutes must be positive' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: matter } = await supabase
    .from('legal_matters')
    .select('id, status')
    .eq('id', matter_id)
    .single()
  if (!matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  if (['declined', 'archived'].includes(matter.status)) {
    return NextResponse.json({ error: 'Cannot log time on a declined or archived matter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      matter_id,
      description,
      entry_date: entry_date || undefined,
      minutes,
      rate: rate || 0,
      billable: billable !== false,
      profile_id: guard.profile.id,
    })
    .select('*, author:profiles(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'time_entries', record_id: data.id, action: 'INSERT', new_data: { matter_id, minutes, rate } })
  return NextResponse.json(data, { status: 201 })
}
