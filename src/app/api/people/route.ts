import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '30')

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (role) query = query.eq('role', role)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

// Roles a manage_matters holder (staff's default) may create directly, e.g.
// onboarding a client account from the matter/client-accounts screen.
// Anything more privileged than that requires manage_users, same gate as
// changing an existing user's role.
const SELF_SERVICE_CREATABLE_ROLES = ['client', 'volunteer', 'public']

export async function POST(req: NextRequest) {
  const body = await req.json()
  const requestedRole = body.role || 'public'

  const guard = SELF_SERVICE_CREATABLE_ROLES.includes(requestedRole)
    ? await requirePermissionApi('manage_matters')
    : await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('profiles').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'profiles', record_id: data.id, action: 'INSERT', new_data: body })
  return NextResponse.json(data, { status: 201 })
}
