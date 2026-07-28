import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { getPermissionCatalog } from '@/lib/permissions'

export async function GET() {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const catalog = await getPermissionCatalog()
  return NextResponse.json(catalog)
}
