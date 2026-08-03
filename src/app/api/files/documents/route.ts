import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getDocumentProvider } from '@/lib/documentProvider'
import { getSessionProfile } from '@/lib/auth'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'

export async function GET(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const matter_id = searchParams.get('matter_id')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  const scope = await getMatterAccessScope(profile)

  // A specific matter was requested, check it against scope. Without a
  // matter_id this would list documents across the whole firm, which only
  // scope.all callers may do.
  if (matter_id) {
    if (!canAccessMatter(scope, matter_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  } else if (!scope.all) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('legal_documents')
    .select('*, uploader:profiles(full_name, avatar_url), matter:legal_matters(matter_number, title, type)')
    .order('created_at', { ascending: false })

  if (matter_id) query = query.eq('matter_id', matter_id)
  if (type) query = query.eq('type', type)
  if (search) query = query.or(`title.ilike.%${search}%,file_name.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()
  const formData = await req.formData()
  const file = formData.get('file') as File
  const matter_id = formData.get('matter_id') as string
  const title = formData.get('title') as string
  const type = formData.get('type') as string
  const description = formData.get('description') as string
  const access_level = formData.get('access_level') as string
  const is_privileged = formData.get('is_privileged') === 'true'
  const uploaded_by = formData.get('uploaded_by') as string
  const tags = JSON.parse((formData.get('tags') as string) || '[]')

  if (!file || !matter_id || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const scope = await getMatterAccessScope(profile)
  if (!canAccessMatter(scope, matter_id)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const ext = file.name.split('.').pop()
  const path = `matters/${matter_id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const stored = await getDocumentProvider().createDocument({ path, content: buffer, contentType: file.type })

  const { data: doc, error } = await supabase
    .from('legal_documents')
    .insert({
      matter_id,
      title,
      type: type || 'other',
      description,
      file_url: stored.publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      access_level: access_level || 'staff',
      is_privileged,
      uploaded_by: uploaded_by || null,
      tags,
      provider_key: stored.providerKey,
      provider_path: stored.path,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log access
  await supabase.from('document_access_log').insert({
    document_id: doc.id,
    accessed_by: uploaded_by || null,
    action: 'upload',
  })

  return NextResponse.json(doc, { status: 201 })
}
