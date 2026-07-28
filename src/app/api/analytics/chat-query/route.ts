import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Public, write-only. Logs what visitors ask the public chat widget, the
// closest signal this site has to "search terms" since there's no search bar.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 500) : null
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 })

    const supabase = createAdminClient()
    await supabase.from('chat_queries').insert({ query })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
