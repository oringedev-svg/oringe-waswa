import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

// Intended to be hit by a scheduled job (Vercel Cron, see vercel.json) on an
// interval. Publishes any post whose scheduled_at has passed. Protected by a
// shared secret rather than a user session, since crons have no cookies.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: due, error: findError } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ published: 0 })

  const ids = due.map((p) => p.id)
  const { error: updateError } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: now, updated_at: now })
    .in('id', ids)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  for (const id of ids) {
    await supabase.from('blog_post_status_history').insert({
      post_id: id,
      from_status: 'scheduled',
      to_status: 'published',
      comments: 'Auto-published by scheduled job',
    })
    await logAudit({ table_name: 'blog_posts', record_id: id, action: 'UPDATE', new_data: { status: 'published', via: 'cron' } })
  }

  return NextResponse.json({ published: ids.length })
}
