import { createAdminClient } from '@/lib/supabase'

export interface CaseResultRow {
  id: string
  title: string
  practice_area?: string
  outcome: string
  summary?: string
  client_type?: string
  year?: number
  image_url?: string
}

// Everything the homepage needs, fetched once, in parallel, on the server.
// The previous version had every section as its own 'use client' component
// firing its own fetch() in useEffect: twelve independent round trips after
// an empty first paint, each one going browser -> our API route -> auth
// middleware -> a fresh Supabase client -> Supabase, competing with the
// other eleven for the same event loop. In testing that meant whole
// sections (capabilities, latest news, testimonials) sitting empty for
// 10-20+ seconds. This does the same Supabase reads directly, server-side,
// in one Promise.all, so the page arrives with the data already in it.
export async function getHomePageData() {
  const supabase = createAdminClient()

  const [
    groupsRes,
    teamRes,
    insightsRes,
    blogRes,
    eventsRes,
    coverageRes,
    awardsRes,
    testimonialsRes,
    announcementSettingRes,
  ] = await Promise.all([
    supabase.from('practice_area_groups').select('*').is('deleted_at', null).order('display_order', { ascending: true }),
    supabase.from('team_members').select('*, profile:profiles(user_id)').eq('is_visible', true).eq('is_active', true).order('display_order', { ascending: true }),
    supabase.from('insights').select('*').is('deleted_at', null).order('published_at', { ascending: false }).range(0, 2),
    supabase.from('blog_posts').select('*, authors:blog_authors(*)').eq('status', 'published').order('published_at', { ascending: false }).range(0, 2),
    supabase.from('events').select('*').is('deleted_at', null).eq('status', 'upcoming').order('event_date', { ascending: true }),
    supabase.from('coverage_areas').select('*').is('deleted_at', null).eq('is_active', true).order('country', { ascending: true }),
    supabase.from('awards').select('*').is('deleted_at', null).order('display_order', { ascending: true }).order('year', { ascending: false }),
    supabase.from('testimonials').select('*').is('deleted_at', null).order('display_order', { ascending: true }),
    supabase.from('site_settings').select('value').eq('key', 'announcement_insight_id').maybeSingle(),
  ])

  // case_results may not exist yet (migration 023 pending). Supabase
  // resolves rather than rejects on a query error, so this is a separate,
  // plain try/catch rather than folded into the Promise.all above, a query
  // error there would not have failed the other nine.
  let caseResults: CaseResultRow[] = []
  try {
    const { data, error } = await supabase.from('case_results').select('*').is('deleted_at', null).eq('is_featured', true).order('display_order', { ascending: true })
    if (!error && data) caseResults = data
  } catch { /* table not created yet */ }

  const announcementId = typeof announcementSettingRes.data?.value === 'string' ? announcementSettingRes.data.value : null
  const announcement = announcementId
    ? (await supabase.from('insights').select('id, title, description, external_url, category, published_at').eq('id', announcementId).maybeSingle()).data
    : null

  return {
    groups: groupsRes.data ?? [],
    team: teamRes.data ?? [],
    insights: insightsRes.data ?? [],
    blogPosts: blogRes.data ?? [],
    events: eventsRes.data ?? [],
    coverage: coverageRes.data ?? [],
    awards: awardsRes.data ?? [],
    testimonials: (testimonialsRes.data ?? []).filter((t: { kind?: string }) => (t.kind ?? 'client') === 'client'),
    caseResults,
    announcement: announcement ?? null,
  }
}

export type HomePageData = Awaited<ReturnType<typeof getHomePageData>>
