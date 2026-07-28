import { NextResponse } from 'next/server'
import { getSessionProfile } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'

export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const permissions = await getUserPermissions(profile.userId, profile.role)
  return NextResponse.json({ ...profile, permissions: Array.from(permissions) })
}
