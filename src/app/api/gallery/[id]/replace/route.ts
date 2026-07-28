import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, uploadFile } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'

// Replaces the underlying file for an existing media record WITHOUT changing
// its public URL, so every place already referencing this image (by URL)
// picks up the new file automatically, with nothing else to update.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: image, error: fetchError } = await supabase.from('gallery_images').select('url').eq('id', params.id).single()
  if (fetchError || !image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // A Supabase public URL looks like:
  //   .../storage/v1/object/public/{bucket}/{path-within-bucket}
  // Split on '/public/' to isolate bucket + path reliably.
  const afterPublic = image.url.split('/public/')[1]
  if (!afterPublic) return NextResponse.json({ error: 'Could not resolve storage path for this image' }, { status: 500 })
  const [, ...pathParts] = afterPublic.split('/')
  const objectPath = pathParts.join('/') // matches the path originally passed to uploadFile()
  if (!objectPath) return NextResponse.json({ error: 'Could not resolve storage path for this image' }, { status: 500 })

  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile('gallery', objectPath, buffer, file.type)

  const { data, error } = await supabase
    .from('gallery_images')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
