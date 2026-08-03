import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const practiceArea = searchParams.get('practice_area')
  const supabase = createAdminClient()
  let query = supabase.from('document_templates').select('id, name, category, practice_area_keys, artifact_type_name, trigger_events, guidance, version').eq('status', 'ACTIVE').eq('usage_scope', 'MATTER').order('category').order('name')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // An empty array indicates a cross-practice template and remains visible
  // alongside templates specifically suited to the selected matter type.
  const templates = (data || []).filter(template =>
    !practiceArea || template.practice_area_keys.length === 0 || template.practice_area_keys.includes(practiceArea)
  )
  return NextResponse.json({ templates })
}
