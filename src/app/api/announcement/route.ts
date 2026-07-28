import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { invalidateSettingsCache } from '@/lib/settings'

// The "pushed announcement" is a single insight promoted to a site-wide
// banner. It is stored as a site_settings key rather than a column on
// insights because only one item is ever announced at a time, so a pointer
// models it more honestly than a per-row flag (and needs no schema change).
const KEY = 'announcement_insight_id'

export const dynamic = 'force-dynamic'

// Public: returns the announced insight, or null. Never 404s, the homepage
// treats "no announcement" as a normal state and renders nothing.
export async function GET() {
  const supabase = createAdminClient()

  const { data: setting } = await supabase
    .from('site_settings').select('value').eq('key', KEY).maybeSingle()

  const id = typeof setting?.value === 'string' ? setting.value : null
  if (!id) return NextResponse.json({ announcement: null })

  const { data: insight, error } = await supabase
    .from('insights')
    .select('id, title, description, external_url, category, published_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !insight) return NextResponse.json({ announcement: null })
  return NextResponse.json({ announcement: insight })
}

// Admin: push an insight to the announcement bar, or clear it by posting
// a null/empty id.
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_homepage')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id } = await req.json()
  const value = id || null

  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSettingsCache()
  await logAudit({ table_name: 'site_settings', record_id: KEY, action: 'UPDATE', new_data: { [KEY]: value } })
  return NextResponse.json({ success: true, announcement_insight_id: value })
}
