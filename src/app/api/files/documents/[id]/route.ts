import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getDocumentProvider } from '@/lib/documentProvider'
import { getSessionProfile } from '@/lib/auth'
import { userHasPermission } from '@/lib/permissions'
import { getMatterAccessScope, canAccessMatter } from '@/lib/matterScope'

async function getDocMatterId(documentId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('legal_documents').select('matter_id').eq('id', documentId).single()
  return data?.matter_id ?? null
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const matterId = await getDocMatterId(params.id)
  if (matterId) {
    const scope = await getMatterAccessScope(profile)
    if (!canAccessMatter(scope, matterId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('legal_documents')
    .select('*, uploader:profiles(full_name), matter:legal_matters(matter_number, title)')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  // Log access
  await supabase.from('document_access_log').insert({ document_id: params.id, action: 'view' })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const canEdit = profile.role === 'admin' || (await userHasPermission(profile.userId, profile.role, 'manage_matters'))
  if (!canEdit) return NextResponse.json({ error: 'Missing permission: manage_matters' }, { status: 403 })

  const supabase = createAdminClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('legal_documents')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const canDelete = profile.role === 'admin' || (await userHasPermission(profile.userId, profile.role, 'manage_matters'))
  if (!canDelete) return NextResponse.json({ error: 'Missing permission: manage_matters' }, { status: 403 })

  const supabase = createAdminClient()
  // Get file path first
  const { data: doc } = await supabase.from('legal_documents').select('provider_key, provider_path').eq('id', params.id).single()
  if (doc?.provider_path) {
    try { await getDocumentProvider(doc.provider_key || 'owa_storage').deleteDocument(doc.provider_path) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not remove document file' }, { status: 500 }) }
  }
  // Log deletion
  await supabase.from('document_access_log').insert({ document_id: params.id, action: 'delete' })
  // Delete record
  const { error } = await supabase.from('legal_documents').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
