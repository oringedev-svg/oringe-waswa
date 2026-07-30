import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, uploadFile } from '@/lib/supabase'

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

// Public and unauthenticated, an applicant has no account to sign in with.
// The apply form and the recruitment admin (uploading on a candidate's
// behalf) both use this, so a resume always ends up in the same bucket
// under the same validation regardless of who attaches it.
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only PDF or Word documents are accepted' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const path = `resumes/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile('resumes', path, buffer, file.type)

  const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(path)

  return NextResponse.json({ url: urlData.publicUrl, file_name: file.name })
}
