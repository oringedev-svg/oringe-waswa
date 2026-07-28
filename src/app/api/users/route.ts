import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'

export async function GET() {
  const guard = await requirePermissionApi('manage_users')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, email, role, is_active, created_at')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: grants } = await supabase.from('user_permissions').select('user_id, permission_key')
  const grantsByUser: Record<string, string[]> = {}
  for (const g of grants || []) {
    grantsByUser[g.user_id] = grantsByUser[g.user_id] || []
    grantsByUser[g.user_id].push(g.permission_key)
  }

  const withGrants = (users || []).map((u) => ({ ...u, grants: grantsByUser[u.user_id] || [] }))
  return NextResponse.json(withGrants)
}
