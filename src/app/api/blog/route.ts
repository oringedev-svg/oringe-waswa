import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { slugify, estimateReadingTime } from '@/lib/utils'
import { moderateBlogContent } from '@/lib/openai'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'published'
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '12')
  const admin = searchParams.get('admin') === 'true'

  let query = supabase
    .from('blog_posts')
    .select('*, authors:blog_authors(*)', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (!admin) query = query.eq('status', 'published')
  else if (status !== 'all') query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { title, content, authors, ...rest } = body

  const slug = slugify(title) + '-' + Date.now().toString(36)
  const reading_time_minutes = estimateReadingTime(content)

  // AI moderation
  let aiMod = null
  try { aiMod = await moderateBlogContent(title, content) } catch {}

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      title,
      slug,
      content,
      reading_time_minutes,
      status: 'draft',
      moderator_notes: aiMod ? JSON.stringify(aiMod) : null,
      ...rest,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert authors
  if (authors?.length) {
    const { error: authorsError } = await supabase.from('blog_authors').insert(
      authors.map((a: { name: string; email?: string; role?: string }) => ({ ...a, post_id: post.id }))
    )
    if (authorsError) {
      console.warn('Blog post created but authors failed to attach:', authorsError.message)
    }
  }

  await logAudit({ table_name: 'blog_posts', record_id: post.id, action: 'INSERT', new_data: { title, status: 'draft' } })

  return NextResponse.json(post, { status: 201 })
}
