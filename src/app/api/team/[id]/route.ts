import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requirePermissionApi } from '@/lib/auth'
import { saveRevision, getRevisions } from '@/lib/revisions'

const REVISIONED_FIELDS = ['full_name', 'position', 'department', 'specializations', 'bio', 'education'] as const

// Only these columns can be written via PATCH. Anything else in the request
// body (e.g. joined fields like `profile`, or a `revisions` array echoed
// back from a prior GET) is silently dropped instead of being sent to
// Supabase, where an unknown column causes an opaque 500.
const UPDATABLE_FIELDS = [
  'full_name',
  'email',
  'phone',
  'position',
  'department',
  'specializations',
  'bio',
  'avatar_url',
  'bar_number',
  'years_experience',
  'display_order',
  'is_visible',
  'is_active',
  'seniority',
  'education',
] as const

function pickUpdatableFields(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) result[field] = body[field]
  }
  return result
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('team_members').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const revisions = await getRevisions('team_members', params.id)
  return NextResponse.json({ ...data, revisions })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const rawBody = await req.json()
  const body = pickUpdatableFields(rawBody)

  try {
    const { data: current } = await supabase
      .from('team_members')
      .select('full_name, position, department, specializations, bio, education')
      .eq('id', params.id)
      .single()

    const changed = current && REVISIONED_FIELDS.some((f) => f in body && JSON.stringify(body[f]) !== JSON.stringify((current as Record<string, unknown>)[f]))
    if (changed) {
      await saveRevision('team_members', params.id, current as unknown as Record<string, unknown>, guard.profile.id)
    }

    const { data, error } = await supabase.from('team_members').update(body).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({ table_name: 'team_members', record_id: params.id, action: 'UPDATE', new_data: body })
    return NextResponse.json(data)
  } catch (err) {
    console.error('PATCH /api/team/[id] failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected server error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('team_members').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_members', record_id: params.id, action: 'DELETE' })
  return NextResponse.json({ success: true })
}