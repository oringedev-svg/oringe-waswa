import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

interface RouteCtx { params: { id: string } }

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const db = createAdminClient()
  const month = req.nextUrl.searchParams.get('month')

  let query = db
    .from('pupillage_workbook_entries')
    .select('*')
    .eq('application_id', params.id)
    .order('entry_date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    const endDate = new Date(start)
    endDate.setMonth(endDate.getMonth() + 1)
    const end = endDate.toISOString().split('T')[0]
    query = query.gte('entry_date', start).lt('entry_date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()

  if (!body.entry_date || !body.description) {
    return NextResponse.json({ error: 'entry_date and description are required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('pupillage_workbook_entries')
    .upsert({
      application_id: params.id,
      entry_date: body.entry_date,
      description: body.description,
      practice_area: body.practice_area,
      hours_spent: body.hours_spent,
    }, { onConflict: 'application_id,entry_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()

  if (body.action === 'sign_off') {
    const { data: entries, error } = await db
      .from('pupillage_workbook_entries')
      .update({
        supervisor_signed_off: true,
        supervisor_signed_at: new Date().toISOString(),
        supervisor_notes: body.notes || null,
        is_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq('application_id', params.id)
      .eq('supervisor_signed_off', false)
      .in('entry_date', body.entry_dates || [])
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await db.from('pupillage_events').insert({
      application_id: params.id,
      type: 'workbook_signoff',
      detail: `${entries?.length || 0} entries signed off by ${profile.fullName}`,
      actor_id: profile.id,
    })

    return NextResponse.json({ signed_off: entries?.length || 0 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
