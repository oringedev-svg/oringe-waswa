import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi } from '@/lib/auth'

export interface SearchResult {
  module: string
  id: string
  label: string
  sublabel?: string
  href: string
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  const supabase = createAdminClient()
  const like = `%${q}%`

  const [team, blog, matters, people, submissions, users, awards, events, resources] = await Promise.all([
    supabase.from('team_members').select('id, full_name, position').or(`full_name.ilike.${like},position.ilike.${like}`).limit(5),
    supabase.from('blog_posts').select('id, title, status').ilike('title', like).limit(5),
    supabase.from('legal_matters').select('id, title, case_number').or(`title.ilike.${like},case_number.ilike.${like}`).limit(5),
    supabase.from('profiles').select('id, full_name, email').or(`full_name.ilike.${like},email.ilike.${like}`).limit(5),
    supabase.from('submissions').select('id, submitter_name, tracking_code').or(`submitter_name.ilike.${like},tracking_code.ilike.${like}`).limit(5),
    supabase.from('profiles').select('id, full_name, email, role').not('user_id', 'is', null).or(`full_name.ilike.${like},email.ilike.${like}`).limit(5),
    supabase.from('awards').select('id, title').ilike('title', like).is('deleted_at', null).limit(5),
    supabase.from('events').select('id, title').ilike('title', like).is('deleted_at', null).limit(5),
    supabase.from('client_resources').select('id, title').ilike('title', like).is('deleted_at', null).limit(5),
  ])

  const results: SearchResult[] = [
    ...(team.data || []).map((r) => ({ module: 'Team', id: r.id, label: r.full_name, sublabel: r.position, href: `/admin/team` })),
    ...(blog.data || []).map((r) => ({ module: 'Blog', id: r.id, label: r.title, sublabel: r.status, href: `/admin/blog/${r.id}` })),
    ...(matters.data || []).map((r) => ({ module: 'Matters', id: r.id, label: r.title, sublabel: r.case_number, href: `/admin/matters/${r.id}` })),
    ...(people.data || []).map((r) => ({ module: 'People', id: r.id, label: r.full_name, sublabel: r.email, href: `/admin/people` })),
    ...(submissions.data || []).map((r) => ({ module: 'Submissions', id: r.id, label: r.submitter_name, sublabel: r.tracking_code, href: `/admin/submissions/${r.id}` })),
    ...(users.data || []).map((r) => ({ module: 'Users', id: r.id, label: r.full_name, sublabel: r.role, href: `/admin/users` })),
    ...(awards.data || []).map((r) => ({ module: 'Awards', id: r.id, label: r.title, href: `/admin/awards` })),
    ...(events.data || []).map((r) => ({ module: 'Events', id: r.id, label: r.title, href: `/admin/events` })),
    ...(resources.data || []).map((r) => ({ module: 'Resources', id: r.id, label: r.title, href: `/admin/resources` })),
  ]

  return NextResponse.json({ results })
}
