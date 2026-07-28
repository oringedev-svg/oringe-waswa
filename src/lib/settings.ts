import { createAdminClient } from './supabase'
import { defaultSettingsMap } from './settingsSchema'

// Simple in-memory cache to avoid hitting Supabase on every single
// page/component render for data that changes rarely. Good enough for
// a single-instance deployment; falls back to a fresh fetch if stale.
let cache: { data: Record<string, unknown>; expires: number } | null = null
const TTL_MS = 30_000

export async function getAllSettings(forceFresh = false): Promise<Record<string, unknown>> {
  if (!forceFresh && cache && cache.expires > Date.now()) {
    return cache.data
  }
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('site_settings').select('key, value')
  const merged = { ...defaultSettingsMap() }
  if (!error && data) {
    for (const row of data) {
      merged[row.key] = row.value
    }
  }
  cache = { data: merged, expires: Date.now() + TTL_MS }
  return merged
}

export function invalidateSettingsCache() {
  cache = null
}
