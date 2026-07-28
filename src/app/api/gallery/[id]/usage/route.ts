import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'

// Computed (not tracked), checks every field across the app known to hold
// an image URL and reports which live records currently reference this one.
// Always accurate, no separate ledger to keep in sync.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_media')
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data: image } = await supabase.from('gallery_images').select('url').eq('id', params.id).single()
  if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const url = image.url
  const [blog, team, insights] = await Promise.all([
    supabase.from('blog_posts').select('id, title').eq('cover_image_url', url),
    supabase.from('team_members').select('id, full_name').eq('avatar_url', url).eq('is_active', true),
    supabase.from('insights').select('id, title').or(`thumbnail_url.eq.${url},media_url.eq.${url}`).is('deleted_at', null),
  ])

  const usage = [
    ...(blog.data || []).map((r) => ({ module: 'Blog Post', id: r.id, label: r.title, href: `/admin/blog/${r.id}` })),
    ...(team.data || []).map((r) => ({ module: 'Team Member', id: r.id, label: r.full_name, href: `/admin/team` })),
    ...(insights.data || []).map((r) => ({ module: 'Insight', id: r.id, label: r.title, href: `/admin/insights` })),
  ]

  return NextResponse.json({ usage, count: usage.length })
}
