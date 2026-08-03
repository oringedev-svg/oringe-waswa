import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requirePermissionApi } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const visible_only = searchParams.get('visible') === 'true'
  const withCategory = searchParams.get('with_category') === 'true'
  const audience = searchParams.get('audience')

  function baseQuery(select: string) {
    let q = supabase.from('team_members').select(select).order('display_order', { ascending: true })
    if (visible_only) q = q.eq('is_visible', true).eq('is_active', true)
    // The public people directory has two distinct presentations. Pupils
    // are intentionally kept out of the main team listing and can only be
    // requested for the public pupil carousel.
    if (visible_only && audience === 'pupils') q = q.eq('seniority', 'pupil')
    if (visible_only && audience === 'team') q = q.neq('seniority', 'pupil')
    return q
  }

  // professional_types (migration 020) may not exist yet on some
  // deployments, callers that want the category embed for a grouped
  // picker fall back to the plain list rather than breaking, since this
  // endpoint also serves the public team page and messaging composer.
  let { data, error } = withCategory
    ? await baseQuery('*, profile:profiles(user_id), professional_type:professional_types(id, name)')
    : await baseQuery('*, profile:profiles(user_id)')
  if (error && withCategory) {
    ;({ data, error } = await baseQuery('*, profile:profiles(user_id)'))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('team_members').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_members', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}
