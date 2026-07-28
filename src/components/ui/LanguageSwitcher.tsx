'use client'
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { SUPPORTED_LANGUAGES, Locale } from '@/lib/i18n'
import { ChevronDown, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  compact?: boolean
  className?: string
}

export default function LanguageSwitcher({ compact = false, className }: LanguageSwitcherProps) {
  const { locale, setLocale, currentLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang.flag}</span>
        {!compact && <span className="hidden sm:inline text-xs font-medium">{currentLang.label}</span>}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] overflow-hidden min-w-[160px] animate-slide-down">
          {SUPPORTED_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLocale(lang.code as Locale); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left',
                locale === lang.code
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]'
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
              {locale === lang.code && <span className="ml-auto text-[var(--color-accent)]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
