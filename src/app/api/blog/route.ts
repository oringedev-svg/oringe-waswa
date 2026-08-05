import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { slugify, estimateReadingTime } from '@/lib/utils'
import { moderateBlogContent } from '@/lib/openai'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '12')
  const admin = searchParams.get('admin') === 'true'
  // Defaulting to 'published' for BOTH callers hid every draft, in-review,
  // scheduled and archived post from the admin list: the blog page omits
  // the status param entirely for its "All" filter, so "All" silently
  // meant "published only" and unpublished work was unreachable from it.
  // The public caller still defaults to published, and is pinned to it
  // by the !admin branch below regardless.
  const status = searchParams.get('status') || (admin ? 'all' : 'published')

  let query = supabase
    .from('blog_posts')
    .select('*, authors:blog_authors(*), comments:blog_comments(count)', { count: 'exact' })
    .order('published_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (!admin) query = query.eq('status', 'published')
  else if (status !== 'all') query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Comments belong to their post, so moderation is discoverable per post
  // rather than from one firm-wide queue. The list needs the pending count
  // as well as the total, otherwise "4 comments" gives no hint that one of
  // them is sitting unapproved. Counted in a single grouped read rather
  // than a second embed per row.
  const pendingByPost = new Map<string, number>()
  if (admin && data.length > 0) {
    const { data: pendingRows } = await supabase
      .from('blog_comments')
      .select('post_id')
      .eq('is_approved', false)
      .in('post_id', data.map((p) => p.id))
    for (const row of pendingRows || []) {
      pendingByPost.set(row.post_id, (pendingByPost.get(row.post_id) || 0) + 1)
    }
  }

  const mappedData = data.map(post => ({
    ...post,
    comments_count: post.comments?.[0]?.count || 0,
    pending_comments_count: pendingByPost.get(post.id) || 0,
  }))

  return NextResponse.json({ data: mappedData, count })
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
