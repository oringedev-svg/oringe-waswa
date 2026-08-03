import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

// The pull-model view over the existing `work_items` table. Queued work is
// deliberately not copied into `assignments` until a person claims it.
export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const mode = new URL(req.url).searchParams.get('mode') || 'queue'
  const supabase = createAdminClient()
  let query = supabase
    .from('work_items')
    .select('id, title, instructions, due_at, urgency, status, context_snapshot, activity_type:activity_types(name, eligible_roles), matter:legal_matters(id, matter_number, title), submission:submissions(id, tracking_code, submitter_name)')
    .order('due_at', { ascending: true, nullsFirst: false })

  if (mode === 'mine') query = query.eq('assigned_to_profile_id', profile.id).neq('status', 'cancelled')
  else query = query.eq('status', 'queued').is('assigned_to_profile_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ work_items: data || [] })
}
