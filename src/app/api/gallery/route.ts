import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, uploadFile } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const featured = searchParams.get('featured') === 'true'
  const trash = searchParams.get('trash') === 'true'

  let query = supabase
    .from('gallery_images')
    .select('*')
    .order('display_order', { ascending: true })

  query = trash ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (category) query = query.eq('category', category)
  if (featured) query = query.eq('is_featured', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const formData = await req.formData()
  const file = formData.get('file') as File
  const caption = formData.get('caption') as string
  const alt_text = formData.get('alt_text') as string
  const category = formData.get('category') as string
  const tags = JSON.parse((formData.get('tags') as string) || '[]')
  const is_featured = formData.get('is_featured') === 'true'
  const uploaded_by = formData.get('uploaded_by') as string

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const path = `gallery/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile('gallery', path, buffer, file.type)

  const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)

  const { data, error } = await supabase
    .from('gallery_images')
    .insert({
      url: urlData.publicUrl,
      caption,
      alt_text: alt_text || caption || '',
      category: category || 'General',
      tags,
      is_featured,
      uploaded_by: uploaded_by || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { id } = await req.json()
  const { error } = await supabase.from('gallery_images').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
