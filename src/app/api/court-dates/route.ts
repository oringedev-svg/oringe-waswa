import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// Court appearances are calendar_events of type 'court'. They are not a new
// table: an appearance already is a diary entry, and keeping one calendar
// means a court date and a client meeting never drift apart or double-book
// the same advocate.

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') ?? 'upcoming'

  let query = supabase
    .from('calendar_events')
    .select('*, matter:legal_matters(id, matter_number, title, client_name, case_number, litigation_status, court_id, court)')
    .eq('type', 'court')
    .neq('status', 'cancelled')

  if (scope === 'upcoming') {
    query = query.gte('start_at', new Date().toISOString()).order('start_at', { ascending: true })
  } else if (scope === 'past') {
    query = query.lt('start_at', new Date().toISOString()).order('start_at', { ascending: false })
  } else {
    query = query.order('start_at', { ascending: true })
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach the court record separately: PostgREST cannot follow a nested
  // relation two levels deep here, and a court date is meaningless without
  // knowing which court it is at.
  // Array.from rather than spreading the Set: the project targets a
  // pre-ES2015 lib without downlevelIteration, so spreading a Set fails
  // to compile.
  const courtIds = Array.from(
    new Set((data ?? []).map(e => (e.matter as { court_id?: string } | null)?.court_id).filter(Boolean))
  )
  let courts: Record<string, { id: string; name: string; station: string | null }> = {}
  if (courtIds.length > 0) {
    const { data: courtRows } = await supabase.from('courts').select('id, name, station').in('id', courtIds as string[])
    courts = Object.fromEntries((courtRows ?? []).map(c => [c.id, c]))
  }

  const enriched = (data ?? []).map(e => {
    const m = e.matter as { court_id?: string } | null
    return { ...e, court: m?.court_id ? courts[m.court_id] ?? null : null }
  })

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  if (!body.matter_id) return NextResponse.json({ error: 'A court date must be attached to a matter' }, { status: 400 })
  if (!body.start_at) return NextResponse.json({ error: 'A date is required' }, { status: 400 })

  // A mention is usually listed for a time, not a duration; default to an
  // hour so it occupies a sensible block in the diary.
  const start = new Date(body.start_at)
  const end = body.end_at ? new Date(body.end_at) : new Date(start.getTime() + 60 * 60 * 1000)

  const payload = {
    title: body.title || 'Court attendance',
    description: body.description ?? null,
    type: 'court',
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    location: body.location ?? null,
    matter_id: body.matter_id,
    created_by: guard.profile.id,
    status: 'scheduled',
  }

  const { data, error } = await supabase.from('calendar_events').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'calendar_events', record_id: data.id, action: 'INSERT', new_data: payload })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, ...updates } = await req.json()
  updates.updated_at = new Date().toISOString()
  const { data, error } = await supabase.from('calendar_events').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'calendar_events', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_matters')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  // Cancelled rather than deleted: an adjourned or vacated date is part of
  // the history of the matter.
  const { error } = await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'calendar_events', record_id: id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}
