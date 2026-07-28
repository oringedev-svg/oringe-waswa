'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { defaultSettingsMap } from '@/lib/settingsSchema'

type SettingsMap = Record<string, unknown>

const SiteSettingsContext = createContext<{ settings: SettingsMap; loading: boolean }>({
  settings: defaultSettingsMap(),
  loading: true,
})

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>(defaultSettingsMap())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/public')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSettings((prev) => ({ ...prev, ...data }))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <SiteSettingsContext.Provider value={{ settings, loading }}>{children}</SiteSettingsContext.Provider>
}

/** Read a single setting with a typed fallback. Falls back to the schema default (or `fallback`) until loaded. */
export function useSetting<T = unknown>(key: string, fallback?: T): T {
  const { settings } = useContext(SiteSettingsContext)
  const value = settings[key]
  return (value !== undefined ? value : fallback) as T
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}
