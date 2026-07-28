import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { post_id, parent_id, author_name, author_email, content } = body

  if (!post_id || !author_name || !author_email || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('blog_comments')
    .insert({ post_id, parent_id, author_name, author_email, content, is_approved: false })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const post_id = searchParams.get('post_id')
  const pending = searchParams.get('pending') === 'true'

  let query = supabase
    .from('blog_comments')
    .select('*')
    .order('created_at', { ascending: true })

  if (post_id) query = query.eq('post_id', post_id)
  if (!pending) query = query.eq('is_approved', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const { id, is_approved, admin_reply } = await req.json()
  const updates: Record<string, unknown> = {}
  if (is_approved !== undefined) updates.is_approved = is_approved
  if (admin_reply !== undefined) { updates.admin_reply = admin_reply; updates.replied_at = new Date().toISOString() }
  const { data, error } = await supabase.from('blog_comments').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
