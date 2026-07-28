import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const body = await req.json()
  const { restore, ...rest } = body
  const updates: Record<string, unknown> = { ...rest }
  if (restore) updates.deleted_at = null
  const { data, error } = await supabase
    .from('gallery_images')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('gallery_images').update({ deleted_at: new Date().toISOString() }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
