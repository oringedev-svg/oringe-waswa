import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Public, write-only, fire-and-forget from the client on every page load.
// Never returns any stored data, this route only accepts, it doesn't serve.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const path = typeof body?.path === 'string' ? body.path.slice(0, 500) : null
    if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

    const supabase = createAdminClient()
    await supabase.from('page_views').insert({
      path,
      referrer: typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null,
    })
    return NextResponse.json({ success: true })
  } catch {
    // Never let analytics break the page it's tracking.
    return NextResponse.json({ success: false })
  }
}
