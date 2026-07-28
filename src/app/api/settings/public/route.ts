import { NextResponse } from 'next/server'
import { getAllSettings } from '@/lib/settings'

// Public, cached, read-only view of site settings for the public-facing
// components (Navbar, Footer, Hero, etc). No secrets live in this table, // those are in `api_keys`, which has no public route.
//
// This handler takes no arguments and calls no dynamic API (cookies/headers),
// so without this, Next.js's App Router treats it as a static route and
// caches its output at the framework level, the function only ever runs
// once, and never again, no matter what changes in the database. The actual
// request-level caching we want is the in-memory TTL inside getAllSettings()
// plus the Cache-Control header below; force-dynamic just makes sure this
// function itself actually runs so those can do their job.
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await getAllSettings()
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
  })
}
