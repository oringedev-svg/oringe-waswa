import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client (for client components)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

// Server client for Server Components / Route Handlers that need cookie-based
// auth lives in `supabase-server.ts`, kept separate so this file (which client
// components import) never pulls in `next/headers`.

// Admin client (bypasses RLS, server only!)
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      // Next patches the global fetch with its Data Cache in the App
      // Router, so PostgREST GETs get cached and keep returning stale rows
      // long after the in-memory TTL in lib/settings.ts has expired, any
      // row changed outside the app (SQL editor, a second admin, a script)
      // stayed invisible until the server was restarted. These are
      // service-role reads whose whole point is current data, so opt them
      // out of that cache.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

// Storage helpers
export function getPublicUrl(bucket: string, path: string) {
  const { data } = createBrowserClient(supabaseUrl, supabaseAnonKey)
    .storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Buffer,
  contentType?: string
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return data
}

export async function deleteFile(bucket: string, path: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}
