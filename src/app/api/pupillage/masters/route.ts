import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const { data, error } = await db
    .from('pupil_masters')
    .select('*, team_member:team_members(id, full_name, email, phone, avatar_url, position, bar_number, years_experience, specializations)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const body = await req.json()

  const required = ['team_member_id', 'lsk_membership_no', 'year_of_admission', 'years_of_practice']
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 })
    }
  }

  const { data, error } = await db
    .from('pupil_masters')
    .insert({
      team_member_id: body.team_member_id,
      lsk_membership_no: body.lsk_membership_no,
      year_of_admission: body.year_of_admission,
      years_of_practice: body.years_of_practice,
      current_pc_no: body.current_pc_no,
      pc_valid_to: body.pc_valid_to,
      pc_evidence_urls: body.pc_evidence_urls || [],
      max_pupils: body.max_pupils || 2,
      practice_areas_offered: body.practice_areas_offered || [],
    })
    .select('*, team_member:team_members(id, full_name, email)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This team member is already registered as a Pupil Master' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const body = await req.json()
  const { id, ...updateData } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data, error } = await db
    .from('pupil_masters')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, team_member:team_members(id, full_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
