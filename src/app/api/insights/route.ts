import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const category = searchParams.get('category')
  const featured = searchParams.get('featured') === 'true'
  const trash = searchParams.get('trash') === 'true'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '12')

  let query = supabase
    .from('insights')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)
  if (featured) query = query.eq('is_featured', true)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase.from('insights').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const { id, restore, ...updates } = await req.json()
  if (restore) updates.deleted_at = null
  const { data, error } = await supabase.from('insights').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await supabase.from('insights').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
