import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Public, deliberately minimal-disclosure: tells the login page whether an
// email belongs to a client account, so it can skip the password field and
// offer a sign-in link instead. Returns false for absolutely everything
// else, unknown emails, staff emails, even a client with no account yet,
// so the only fact this endpoint ever confirms is "this address can use
// passwordless client sign-in," not whether an email exists in the system.
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') return NextResponse.json({ isClient: false })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  // True even before their first login, a client profile with no account
  // yet still qualifies for passwordless sign-in; the first magic link IS
  // how the account gets created.
  const isClient = data?.role === 'client'
  return NextResponse.json({ isClient })
}
