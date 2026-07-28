import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, deleteFile } from '@/lib/supabase'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
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
  const supabase = createAdminClient()
  // Get file path first
  const { data: doc } = await supabase.from('legal_documents').select('file_url, file_name').eq('id', params.id).single()
  // Log deletion
  await supabase.from('document_access_log').insert({ document_id: params.id, action: 'delete' })
  // Delete record
  const { error } = await supabase.from('legal_documents').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
