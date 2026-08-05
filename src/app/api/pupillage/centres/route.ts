import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const { data, error } = await db
    .from('pupillage_centres')
    .select('*, supervisor:team_members!designated_supervisor_id(id, full_name, email)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const body = await req.json()

  if (!body.firm_id || !body.firm_name) {
    return NextResponse.json({ error: 'firm_id and firm_name are required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('pupillage_centres')
    .upsert({
      firm_id: body.firm_id,
      firm_name: body.firm_name,
      postal_address: body.postal_address,
      physical_address: body.physical_address,
      centre_category: body.centre_category || 'law_firm',
      accreditation_ref: body.accreditation_ref,
      designated_supervisor_id: body.designated_supervisor_id,
      supervisor_phone: body.supervisor_phone,
      supervisor_email: body.supervisor_email,
    }, { onConflict: 'firm_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
