import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

/** Shared matter taxonomy for intake. Conveyancing stays in history but is
 * intentionally excluded from active selection. */
export async function GET() {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()
  const [{ data: areas, error }, { data: types }, { data: templates }] = await Promise.all([
    supabase.from('practice_areas').select('id, title, top_level_category').eq('is_active', true).not('reference_description', 'is', null).is('deleted_at', null).order('display_order'),
    supabase.from('matter_types').select('id, practice_area_id, name, decided_default').order('name'),
    supabase.from('matter_type_templates').select('matter_type_id, event:events(name), required, artifact:matter_type_template_artifacts(artifact:artifact_types(name))'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ areas: areas || [], types: types || [], templates: templates || [] })
}
