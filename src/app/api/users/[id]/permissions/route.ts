import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// `params.id` here is the profiles.id (primary key), not the auth user_id, // consistent with every other /api/people /api/team-style route in this app.
async function resolveUserId(profileId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase.from('profiles').select('user_id').eq('id', profileId).single()
  return data?.user_id as string | undefined
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const permissionKey = body.permission_key as string
  if (!permissionKey) return NextResponse.json({ error: 'permission_key is required' }, { status: 400 })

  const userId = await resolveUserId(params.id)
  if (!userId) return NextResponse.json({ error: 'User has no linked auth account' }, { status: 404 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_permissions')
    .upsert({ user_id: userId, permission_key: permissionKey, granted_by: guard.profile.userId }, { onConflict: 'user_id,permission_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    table_name: 'user_permissions',
    record_id: params.id,
    action: 'INSERT',
    new_data: { permission_key: permissionKey },
    performed_by: guard.profile.id,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const permissionKey = searchParams.get('permission_key')
  if (!permissionKey) return NextResponse.json({ error: 'permission_key is required' }, { status: 400 })

  const userId = await resolveUserId(params.id)
  if (!userId) return NextResponse.json({ error: 'User has no linked auth account' }, { status: 404 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('permission_key', permissionKey)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    table_name: 'user_permissions',
    record_id: params.id,
    action: 'DELETE',
    old_data: { permission_key: permissionKey },
    performed_by: guard.profile.id,
  })

  return NextResponse.json({ success: true })
}
