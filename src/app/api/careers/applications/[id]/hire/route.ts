import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const CATEGORY_DEPARTMENT: Record<string, string> = {
  trainee_program: 'Legal',
  qualified_lawyers: 'Legal',
  business_services: 'Business Services',
  support_staff: 'Operations',
}

// Onboarding, scoped deliberately narrow: creates the staff record
// (profiles + team_members) so the person exists in the firm's systems and
// certificates can be issued to them, but does NOT create sign-in
// credentials. Granting a login is a separate, deliberate step the firm
// takes through Admin -> Users, same as it would for anyone else, not
// something a hiring decision should silently trigger.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const { position, department } = await req.json().catch(() => ({}))
  const supabase = createAdminClient()

  const { data: application, error: fetchError } = await supabase
    .from('job_applications')
    .select('*, job_openings(title, category)')
    .eq('id', params.id)
    .single()
  if (fetchError || !application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  if (application.onboarded_profile_id) {
    return NextResponse.json({ error: 'This application has already been onboarded' }, { status: 400 })
  }

  const resolvedPosition = position?.trim() || application.job_openings?.title || 'Team Member'
  const category = application.job_openings?.category || application.category
  const resolvedDepartment = department?.trim() || CATEGORY_DEPARTMENT[category] || 'Legal'

  // Reuse an existing profile if this email is already known (a former
  // client or volunteer becoming staff, for instance), rather than
  // erroring on the table's UNIQUE(email) constraint.
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', application.email).maybeSingle()

  let profileId = existingProfile?.id as string | undefined
  if (!profileId) {
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({ full_name: application.full_name, email: application.email, phone: application.phone, role: 'staff' })
      .select('id')
      .single()
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    profileId = newProfile.id
  } else {
    // Was staff-eligible already, e.g. a volunteer or public profile;
    // hiring them promotes the role. Never downgrades an existing admin.
    await supabase.from('profiles').update({ role: 'staff' }).eq('id', profileId).neq('role', 'admin')
  }

  const { data: teamMember, error: teamError } = await supabase
    .from('team_members')
    .insert({
      profile_id: profileId,
      full_name: application.full_name,
      email: application.email,
      phone: application.phone,
      position: resolvedPosition,
      department: resolvedDepartment,
      is_visible: false, // Off the public team page until the firm chooses to publish it.
    })
    .select('id')
    .single()
  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 })

  const now = new Date().toISOString()
  const { data: updatedApplication, error: updateError } = await supabase
    .from('job_applications')
    .update({
      status: 'hired',
      onboarded_at: now,
      onboarded_profile_id: profileId,
      onboarded_team_member_id: teamMember.id,
      reviewed_by: guard.profile.id,
      reviewed_at: now,
    })
    .eq('id', params.id)
    .select()
    .single()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('job_application_events').insert({
    application_id: params.id,
    type: 'onboarded',
    detail: `Onboarded as ${resolvedPosition}, ${resolvedDepartment}`,
    actor_id: guard.profile.id,
  })
  await logAudit({ table_name: 'job_applications', record_id: params.id, action: 'UPDATE', new_data: { onboarded: true, profile_id: profileId } })

  return NextResponse.json({ application: updatedApplication, profile_id: profileId, team_member_id: teamMember.id })
}
