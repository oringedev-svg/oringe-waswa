import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const email = searchParams.get('email')

  if (!code) return NextResponse.json({ error: 'Tracking code required' }, { status: 400 })

  const supabase = createAdminClient()
  let query = supabase
    .from('submissions')
    .select('id, tracking_code, type, status, submitter_name, created_at, updated_at, updates:submission_updates(id, status, message, is_public, created_at)')
    .eq('tracking_code', code.toUpperCase())

  if (email) query = query.eq('submitter_email', email)

  const { data, error } = await query.single()
  if (error || !data) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

  // Filter to public updates only
  const filtered = {
    ...data,
    updates: data.updates?.filter((u: { is_public: boolean }) => u.is_public) || [],
  }

  return NextResponse.json(filtered)
}
