import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase'

// My Desk is intentionally assignment-first. It never exposes the shared
// intake queue merely because somebody can sign in; that requires the
// separate triage_intake permission.
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const permissions = await getUserPermissions(profile.userId, profile.role)
  const canViewAssignedWork = permissions.has('view_assigned_work') || profile.role === 'admin'
  const canTriage = permissions.has('triage_intake') || profile.role === 'admin'

  if (!canViewAssignedWork) {
    return NextResponse.json({ items: [], canTriage, canAssign: false })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('work_items')
    .select('id, title, status, urgency, due_at, instructions, activity_type:activity_types(name, category), matter:legal_matters(matter_number, title), submission:submissions(tracking_code, submitter_name)')
    .eq('assigned_to_profile_id', profile.id)
    .in('status', ['queued', 'in_progress', 'blocked'])
    .order('due_at', { ascending: true, nullsFirst: false })

  // The endpoint is safe to deploy before the migration: an empty desk is
  // preferable to locking a user out while the Activity Library is rolled
  // out to an existing Supabase project.
  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      return NextResponse.json({ items: [], canTriage, canAssign: permissions.has('assign_work') || profile.role === 'admin' })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    items: data ?? [],
    canTriage,
    canAssign: permissions.has('assign_work') || profile.role === 'admin',
  })
}
