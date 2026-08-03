import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getDocumentProvider } from '@/lib/documentProvider'
import { getSessionProfile, isAdminRole } from '@/lib/auth'

// Upload a deliverable to an assignment, the "here's the work" counterpart
// to the text comment: assignees attach documents here while In Progress
// or when submitting, so the reviewer has something concrete to approve.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: assignment, error: fetchError } = await supabase
    .from('assignments')
    .select('id, matter_id, submission_id, assigned_by, assigned_to')
    .eq('id', params.id)
    .single()

  if (fetchError || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle()

  const isParty = assignment.assigned_by === profile.id || (!!teamMember && assignment.assigned_to === teamMember.id)
  if (!isParty && !isAdminRole(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  const documentType = (formData.get('document_type') as string) || 'work_product'
  const deliverableId = formData.get('deliverable_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }

  const path = `assignments/${params.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const stored = await getDocumentProvider().createDocument({ path, content: buffer, contentType: file.type })

  // legal_documents, not the separate `documents` table (built for the AI
  // extraction pipeline): Matter Documents reads only legal_documents, so a
  // deliverable attached here needs to land in the same table to actually
  // show up there, rather than in a second table nothing else displays.
  const { data: doc, error: createError } = await supabase
    .from('legal_documents')
    .insert({
      matter_id: assignment.matter_id,
      submission_id: assignment.submission_id,
      assignment_id: params.id,
      title: file.name,
      type: documentType,
      file_name: file.name,
      file_url: stored.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      access_level: 'staff',
      uploaded_by: profile.id,
      provider_key: stored.providerKey,
      provider_path: stored.path,
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }
  if (deliverableId) {
    const { data: deliverable } = await supabase.from('deliverables').select('id').eq('id', deliverableId).eq('assignment_id', params.id).maybeSingle()
    if (!deliverable) return NextResponse.json({ error: 'Deliverable does not belong to this assignment' }, { status: 422 })
    await supabase.from('deliverables').update({ artifact_id: doc.id, status: 'PRODUCED' }).eq('id', deliverable.id)
  }

  await supabase.from('assignment_messages').insert({
    assignment_id: params.id,
    sender_id: profile.id,
    message_type: 'System',
    content: `${profile.fullName || 'Someone'} attached ${file.name}`,
  })

  return NextResponse.json(doc, { status: 201 })
}
