import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/auth'
import { isDriveConfigured, uploadDocument } from '@/lib/google-drive'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  if (!isDriveConfigured()) {
    return NextResponse.json({ error: 'Google Drive not configured' }, { status: 501 })
  }

  const supabase = createAdminClient()

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, matter_id, assigned_to, status')
    .eq('id', params.id)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  if (assignment.status !== 'In Progress') {
    return NextResponse.json({ error: 'Assignment must be In Progress' }, { status: 400 })
  }

  if (!assignment.matter_id) {
    return NextResponse.json({ error: 'Assignment has no linked matter' }, { status: 400 })
  }

  const { data: matter } = await supabase
    .from('legal_matters')
    .select('google_drive_folder_id')
    .eq('id', assignment.matter_id)
    .single()

  if (!matter?.google_drive_folder_id) {
    return NextResponse.json({ error: 'Matter has no Drive folder' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const { fileId, fileUrl } = await uploadDocument(
    file.name,
    matter.google_drive_folder_id,
    buffer,
    file.type || 'application/octet-stream',
  )

  return NextResponse.json({ fileId, fileUrl }, { status: 201 })
}
