import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile } from '@/lib/auth'

const CHECKLIST_TYPES = [
  'signed_deed',
  'pm_current_pc',
  'pm_5yr_pcs',
  's10_exemption',
  'registration_form_d',
  'pupil_id_copy',
  'pupil_academic_docs',
  'pupil_kra_bank',
] as const

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const status = req.nextUrl.searchParams.get('status')
  const masterId = req.nextUrl.searchParams.get('master_id')

  let query = db
    .from('pupillage_applications')
    .select(`
      *,
      pupil_master:pupil_masters(
        id, lsk_membership_no, years_of_practice, current_pc_no, pc_valid_to,
        team_member:team_members(id, full_name, email, avatar_url, position)
      ),
      centre:pupillage_centres(id, firm_name),
      checklist:pupillage_checklist_items(id, document_type, status)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (masterId) query = query.eq('pupil_master_id', masterId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const db = createAdminClient()
  const body = await req.json()

  const { pupil_master_id, ...pupilData } = body

  if (!pupil_master_id) {
    return NextResponse.json({ error: 'pupil_master_id is required' }, { status: 400 })
  }

  const { data: app, error } = await db
    .from('pupillage_applications')
    .insert({
      pupil_profile_id: profile.id,
      pupil_master_id,
      pupil_full_name: pupilData.pupil_full_name || profile.fullName,
      pupil_email: pupilData.pupil_email || profile.email,
      ...pupilData,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed the document checklist
  const checklistRows = CHECKLIST_TYPES.map(docType => ({
    application_id: app.id,
    document_type: docType,
    is_required: docType !== 's10_exemption',
    is_applicable: docType !== 's10_exemption',
  }))

  await db.from('pupillage_checklist_items').insert(checklistRows)

  // Log event
  await db.from('pupillage_events').insert({
    application_id: app.id,
    type: 'application_created',
    detail: `Application created by ${profile.fullName}`,
    actor_id: profile.id,
  })

  return NextResponse.json(app, { status: 201 })
}
