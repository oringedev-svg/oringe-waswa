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

  // A password-recovery link must NOT be spent here.
  // exchangeCodeForSession() consumes a single-use code, and anything that
  // merely *loads* this URL spends it -- Gmail's link scanner, a corporate
  // mail security prefetcher, a preview generator. The human then clicks a
  // link the server correctly reports as already used, requests another,
  // and the replacement gets scanned and burned exactly the same way, which
  // is the "every reset link says it's already been used" loop.
  //
  // So for recovery, hand the code to the reset page unspent and let the
  // actual form submission exchange it. Only a real person filling in a
  // password consumes anything. Magic-link sign-in below is unchanged: it
  // has nowhere further to hand off to, and auto-exchange is the whole
  // point of that flow.
  if (code && next.startsWith('/reset-password')) {
    const forward = new URL(`${origin}/reset-password`)
    forward.searchParams.set('code', code)
    return NextResponse.redirect(forward)
  }

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
