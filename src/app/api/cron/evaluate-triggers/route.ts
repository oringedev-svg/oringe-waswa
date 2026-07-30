import { NextRequest, NextResponse } from 'next/server'
import { evaluateDelayedTriggers } from '@/lib/triggerEngine'

// The "statutory time expired" half of the trigger engine: a demand letter's
// response period, a gazette notice period, an objection window, all
// modelled as a delay_days trigger rule rather than a dummy "waiting" work
// item. Meant to be hit on a schedule (see vercel.json.bak, currently
// disabled firm-wide, add this path back in alongside blog/publish-
// scheduled when ready to turn crons back on). Protected the same way that
// one is, a shared secret rather than a session, since crons have no cookies.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await evaluateDelayedTriggers()
  return NextResponse.json(result)
}
