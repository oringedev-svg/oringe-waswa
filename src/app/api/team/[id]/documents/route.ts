import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, uploadFile } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_documents')
    .select('*, document_type:document_types(id, name)')
    .eq('team_member_id', params.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Accepts either a file upload (multipart, records status='uploaded') or a
// status-only record with no file yet (e.g. marking something 'pending').
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const contentType = req.headers.get('content-type') || ''

  let documentTypeId: string
  let status = 'required'
  let issueDate: string | null = null
  let expiryDate: string | null = null
  let notes: string | null = null
  let fileUrl: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    documentTypeId = formData.get('document_type_id') as string
    issueDate = (formData.get('issue_date') as string) || null
    expiryDate = (formData.get('expiry_date') as string) || null
    notes = (formData.get('notes') as string) || null
    const file = formData.get('file') as File | null
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const path = `${params.id}/${Date.now()}-${file.name}`
      await uploadFile('team-documents', path, buffer, file.type)
      const { data: publicData } = supabase.storage.from('team-documents').getPublicUrl(path)
      fileUrl = publicData.publicUrl
      status = 'uploaded'
    }
  } else {
    const body = await req.json()
    documentTypeId = body.document_type_id
    status = body.status || 'required'
    issueDate = body.issue_date || null
    expiryDate = body.expiry_date || null
    notes = body.notes || null
  }

  if (!documentTypeId) return NextResponse.json({ error: 'document_type_id is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('team_member_documents')
    .insert({
      team_member_id: params.id,
      document_type_id: documentTypeId,
      file_url: fileUrl,
      status,
      issue_date: issueDate,
      expiry_date: expiryDate,
      notes,
      uploaded_by: guard.profile.id,
    })
    .select('*, document_type:document_types(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_member_documents', record_id: data.id, action: 'INSERT', new_data: { document_type_id: documentTypeId, status } })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  updates.updated_at = new Date().toISOString()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_documents')
    .update(updates)
    .eq('id', id)
    .select('*, document_type:document_types(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ table_name: 'team_member_documents', record_id: id, action: 'UPDATE', new_data: updates })
  return NextResponse.json(data)
}
