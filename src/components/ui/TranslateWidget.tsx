'use client'
import { useEffect, useState } from 'react'
import { Globe, ChevronDown } from 'lucide-react'

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: {
      translate: {
        TranslateElement: new (config: object, elementId: string) => void
      }
    }
  }
}

// Ordered by realistic visitor volume for a Nairobi law firm, not
// alphabetically or by global speaker count:
//   1. Kenya's two official languages — the overwhelming majority of
//      traffic.
//   2. Kenya's largest resident/business immigrant communities, who
//      realistically visit a Nairobi law firm's site in meaningful
//      numbers: the Chinese business/investor community, and the
//      long-established South Asian community (Gujarati, Hindi, Punjabi,
//      Urdu — often now more comfortable in English/Hindi than a South
//      Asian language, but offered for the segment that prefers it).
//   3. Cross-border business languages: French (Francophone Africa/DRC/EAC
//      trade), Arabic (Gulf business ties).
//   4. Kenya's own Google-Translate-supported indigenous language plus the
//      Horn of Africa communities with a strong, active Nairobi presence
//      (Somali — notably Eastleigh's business district; Ethiopian/Eritrean
//      community — Amharic, Tigrinya; North Eastern Kenya — Oromo).
//   5. East African Community neighbors doing regular cross-border
//      business with Kenya: Kinyarwanda, Luganda.
//   6. Wider international business languages, roughly by global economic
//      weight: Portuguese, Spanish, German, Italian, Russian, Japanese,
//      Korean.
//   7. Other African languages — included for completeness/reach, but
//      realistically lower volume for this specific market than the
//      groups above.
//   8. Everything else Google Translate supports.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'luo', name: 'Dholuo', flag: '🇰🇪' },
  { code: 'so', name: 'Soomaali', flag: '🇸🇴' },

  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '中文 (繁體)', flag: '🇹🇼' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'am', name: 'አማርኛ', flag: '🇪🇹' },
  { code: 'ti', name: 'ትግርኛ', flag: '🇪🇷' },
  { code: 'om', name: 'Afaan Oromoo', flag: '🇪🇹' },
  { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
  { code: 'lg', name: 'Luganda', flag: '🇺🇬' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu', flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
]

interface TranslateWidgetProps {
  compact?: boolean
  /** Render the trigger for use on a dark/ink background (e.g. the footer). */
  onDark?: boolean
}

export default function TranslateWidget({ compact = false, onDark = false }: TranslateWidgetProps) {
  const [current, setCurrent] = useState('en')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loaded, setLoaded] = useState(false)

  // Every cookie variant Google might read, so a change applies on
  // localhost (host-only cookie) and on a real domain (host and dot-host)
  // alike. Writing only one of these was part of why switching languages
  // silently did nothing.
  function writeGoogTrans(value: string | null) {
    const host = window.location.hostname
    const isPlainHost = !host || host === 'localhost' || /^[\d.]+$/.test(host)
    const domains = isPlainHost ? [null] : [null, host, `.${host}`]
    for (const d of domains) {
      const suffix = d ? `;domain=${d}` : ''
      document.cookie = value === null
        ? `googtrans=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/${suffix}`
        : `googtrans=${value};path=/${suffix}`
    }
  }

  useEffect(() => {
    // Reflect a translation that is already active (set on a previous load
    // via the cookie) so the trigger does not keep claiming "English".
    const active = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/)
    if (active?.[1]) setCurrent(decodeURIComponent(active[1]))

    if (!document.getElementById('google-translate-script')) {
      window.googleTranslateElementInit = () => {
        if (window.google?.translate?.TranslateElement) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              autoDisplay: false,
              multilanguagePage: true,
              // Without an explicit list the hidden <select> renders with no
              // <option> children, so setting select.value never matched
              // anything and the change event did nothing at all.
              includedLanguages: SUPPORTED_LANGUAGES.map(l => l.code).join(','),
            },
            'google_translate_element_hidden'
          )
          setLoaded(true)
        }
      }

      const script = document.createElement('script')
      script.id = 'google-translate-script'
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      script.async = true
      document.body.appendChild(script)
    } else {
      setLoaded(true)
    }
  }, [])

  function translateTo(langCode: string) {
    setCurrent(langCode)
    setOpen(false)
    setSearch('')

    // Always cookie + full reload, never the live <select> swap. Driving
    // Google's own dropdown in place used to look like the "real" fix, but
    // this is a Next.js app: client-side route changes re-render through
    // React, which has no idea Google rewrote the DOM out of band. The
    // in-place swap would work on the page you were on and then silently
    // vanish (or throw a DOM reconciliation error) on the very next Link
    // click. A reload is the one method Google's widget was actually built
    // for: it reads the cookie fresh on every full document load.
    writeGoogTrans(langCode === 'en' ? null : `/en/${langCode}`)
    window.location.reload()
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === current) || SUPPORTED_LANGUAGES[0]
  const filtered = search
    ? SUPPORTED_LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase())
      )
    : SUPPORTED_LANGUAGES

  return (
    <>
      {/* Hidden Google Translate element */}
      <div id="google_translate_element_hidden" className="hidden" />

      {/* Custom language selector */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 transition-colors ${onDark ? 'hover:text-[var(--color-on-ink)]' : 'hover:text-[var(--color-accent)]'} ${
            compact
              ? `text-xs p-1.5 ${onDark ? 'text-[var(--color-on-ink-muted)]' : 'text-[var(--color-text-muted)]'}`
              : `text-sm px-3 py-2 rounded-md ${onDark ? 'text-[var(--color-on-ink-muted)] hover:bg-white/10' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'}`
          }`}
        >
          <Globe className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {!compact && (
            <>
              <span>{currentLang.flag} {currentLang.name}</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-xl)] z-50 overflow-hidden animate-slide-down">
              {/* Search */}
              <div className="p-2 border-b border-[var(--color-border)]">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search language…"
                  className="input text-xs py-2"
                  autoFocus
                />
              </div>

              {/* Language list */}
              <div className="max-h-64 overflow-y-auto">
                {filtered.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => translateTo(lang.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-[var(--color-surface-overlay)] transition-colors ${
                      current === lang.code ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.name}</span>
                    {current === lang.code && <span className="ml-auto text-xs text-[var(--color-accent)]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}