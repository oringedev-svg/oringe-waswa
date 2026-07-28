import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { invalidateSettingsCache } from '@/lib/settings'
import { requirePermissionApi } from '@/lib/auth'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('site_settings').select('*').order('key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_settings')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()

  // Don't JSON.stringify(value) here, the supabase-js client already
  // serializes native JS values correctly for a jsonb column. Stringifying
  // first stores a jsonb *string* containing escaped JSON text instead of a
  // proper jsonb object/array/number, corrupting every non-string setting.
  const upserts = Object.entries(body).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('site_settings')
    .upsert(upserts, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSettingsCache()
  await logAudit({ table_name: 'site_settings', action: 'UPDATE', new_data: body })

  return NextResponse.json({ success: true })
}
