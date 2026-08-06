import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

function groupCount(items: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = item.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('range') || '30'), 1), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createAdminClient()

  const [
    { count: totalViews },
    pageRows,
    chatRows,
    { data: submissionsInRange },
    { data: topBlogPosts },
  ] = await Promise.all([
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('page_views').select('path').gte('created_at', since).limit(5000),
    supabase.from('chat_queries').select('query').gte('created_at', since).limit(2000),
    supabase.from('submissions').select('type, status, created_at').gte('created_at', since).not('email_verified_at', 'is', null).limit(5000),
    supabase.from('blog_posts').select('id, title, views').order('views', { ascending: false }).limit(10),
  ])

  const paths = (pageRows.data || []).map((r) => r.path)
  const topPages = groupCount(paths).slice(0, 10)

  const blogPaths = paths.filter((p) => p.startsWith('/blog/'))
  const topArticlesByRecentViews = groupCount(blogPaths).slice(0, 10)

  const queries = (chatRows.data || []).map((r) => r.query.toLowerCase())
  const topQueries = groupCount(queries).slice(0, 10)

  const submissions = submissionsInRange || []
  const byType = groupCount(submissions.map((s) => s.type))
  const byStatus = groupCount(submissions.map((s) => s.status))

  // Daily submission counts for a simple trend line
  const dailyMap = new Map<string, number>()
  for (const s of submissions) {
    const day = s.created_at.slice(0, 10)
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1)
  }
  const dailyEnquiries = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    range: days,
    totalPageViews: totalViews || 0,
    totalEnquiries: submissions.length,
    topPages,
    topArticlesByRecentViews,
    topArticlesAllTime: (topBlogPosts || []).map((p) => ({ label: p.title, count: p.views, id: p.id })),
    topQueries,
    enquiriesByType: byType,
    enquiriesByStatus: byStatus,
    dailyEnquiries,
  })
}
