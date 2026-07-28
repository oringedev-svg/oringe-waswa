'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Locale, SUPPORTED_LANGUAGES, t as translate, TranslationKey } from '@/lib/i18n'

interface LanguageContextType {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (section: TranslationKey, key: string) => string
  isRTL: boolean
  currentLang: typeof SUPPORTED_LANGUAGES[number]
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (section, key) => key,
  isRTL: false,
  currentLang: SUPPORTED_LANGUAGES[0],
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const saved = localStorage.getItem('ow_locale') as Locale
    if (saved) setLocaleState(saved)
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('ow_locale', l)
    // Set dir attribute for RTL languages
    const lang = SUPPORTED_LANGUAGES.find(x => x.code === l)
    document.documentElement.dir = (lang as { rtl?: boolean })?.rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }, [])

  const tFn = useCallback(
    (section: TranslationKey, key: string) => translate(section, key, locale),
    [locale]
  )

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === locale) || SUPPORTED_LANGUAGES[0]
  const isRTL = !!(currentLang as { rtl?: boolean }).rtl

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: tFn, isRTL, currentLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
