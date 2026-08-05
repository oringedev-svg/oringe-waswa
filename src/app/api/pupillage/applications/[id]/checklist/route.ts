import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

interface RouteCtx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const { data, error } = await db
    .from('pupillage_checklist_items')
    .select('*')
    .eq('application_id', params.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const body = await req.json()
  const { item_id, ...updateData } = body

  if (!item_id) return NextResponse.json({ error: 'item_id is required' }, { status: 400 })

  if (updateData.status === 'verified') {
    updateData.verified_by = guard.profile.id
    updateData.verified_at = new Date().toISOString()
  }

  const { data, error } = await db
    .from('pupillage_checklist_items')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', item_id)
    .eq('application_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if all required+applicable items are now verified
  const { data: allItems } = await db
    .from('pupillage_checklist_items')
    .select('status, is_required, is_applicable')
    .eq('application_id', params.id)

  const allDone = allItems?.every(item =>
    !item.is_required || !item.is_applicable || item.status === 'verified' || item.status === 'not_applicable'
  )

  if (allDone) {
    await db
      .from('pupillage_applications')
      .update({ status: 'ready_for_signature', updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .in('status', ['documents_pending', 'deed_generated'])
  }

  return NextResponse.json({ item: data, all_verified: allDone })
}
