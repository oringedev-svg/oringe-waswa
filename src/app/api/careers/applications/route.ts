import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const status = searchParams.get('status')

  let query = supabase
    .from('job_applications')
    .select('*, job_openings(title)')
    .order('created_at', { ascending: false })
    // An applicant who hasn't confirmed their email doesn't reach the
    // recruiter's queue -- same rule as every other public intake form.
    .not('email_verified_at', 'is', null)
  if (category) query = query.eq('category', category)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_careers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id, status } = await req.json()
  const { data, error } = await supabase.from('job_applications').update({ status }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'job_applications', record_id: id, action: 'UPDATE', new_data: { status } })
  return NextResponse.json(data)
}
