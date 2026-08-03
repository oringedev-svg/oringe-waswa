import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient } from '@/lib/auth'

// The other half of the magic-link flow. signInWithOtp (via @supabase/ssr's
// browser client) sends a PKCE link: the email points here with a `code`
// param, not straight at the destination page. Until this route existed,
// nothing ever exchanged that code for a session. The link opened,
// middleware found no cookie, and bounced every client back to /login to
// request a new link that would fail exactly the same way. This is that
// missing exchange.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next') || '/portal'
  // Never turn an authentication email into an open redirect. Only local
  // application routes are valid continuations after the code exchange.
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/portal'

  if (code) {
    const supabase = createRouteSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Missing or already-used code (links are single-use and expire): back to
  // login with a reason, rather than silently repeating the same loop.
  return NextResponse.redirect(`${origin}/login?error=link_expired`)
}
