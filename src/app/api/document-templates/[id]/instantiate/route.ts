import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'
import { getDocumentProvider } from '@/lib/documentProvider'

// A template never becomes the client document. This endpoint makes a new
// matter-owned working copy and records the exact template/version used.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { matter_id, title } = await req.json()
  if (!matter_id) return NextResponse.json({ error: 'matter_id is required' }, { status: 422 })
  const scope = await getMatterAccessScope(profile)
  if (!canAccessMatter(scope, matter_id)) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const supabase = createAdminClient()
  const { data: template, error: templateError } = await supabase
    .from('document_templates')
    .select('id, name, storage_path, file_extension, version, artifact_type_name, usage_scope, status, practice_area_keys')
    .eq('id', params.id)
    .single()
  if (templateError || !template || template.status !== 'ACTIVE' || template.usage_scope !== 'MATTER' || !template.storage_path) {
    return NextResponse.json({ error: 'Template is unavailable' }, { status: 404 })
  }
  const { data: matter, error: matterError } = await supabase.from('legal_matters').select('id, type').eq('id', matter_id).single()
  if (matterError || !matter) return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  if (template.practice_area_keys.length > 0 && !template.practice_area_keys.includes(matter.type)) {
    return NextResponse.json({ error: 'This template is not configured for the selected matter type.' }, { status: 422 })
  }

  let source: Blob
  try { source = await getDocumentProvider().downloadDocument(template.storage_path) }
  catch { return NextResponse.json({ error: 'Template file is unavailable; import the drafting library first.' }, { status: 409 }) }
  const extension = template.file_extension === 'doc' ? 'doc' : 'docx'
  const safeName = `${(title || template.name).replace(/[^a-zA-Z0-9._-]/g, '_')}.${extension}`
  const storagePath = `matters/${matter_id}/drafts/${Date.now()}-${safeName}`
  const buffer = Buffer.from(await source.arrayBuffer())
  const contentType = extension === 'doc' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  let stored
  try { stored = await getDocumentProvider().createDocument({ path: storagePath, content: buffer, contentType }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create document' }, { status: 500 }) }
  const { data: document, error: insertError } = await supabase.from('legal_documents').insert({
    matter_id, title: title || template.name, type: 'other', description: `Working copy created from ${template.name} (template v${template.version}). Review and complete before use.`,
    file_url: stored.publicUrl, file_name: safeName, file_size: buffer.length, mime_type: contentType,
    access_level: 'staff', uploaded_by: profile.id, template_id: template.id, template_version: template.version,
    provider_key: stored.providerKey, provider_path: stored.path,
  }).select().single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json(document, { status: 201 })
}
