'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, CornerDownLeft } from 'lucide-react'

interface SearchResult {
  module: string
  id: string
  label: string
  sublabel?: string
  href: string
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl+K to open and focus
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Click outside to close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    fetch(`/api/admin-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => { setResults(d.results || []); setActiveIndex(0) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  function go(result: SearchResult) {
    router.push(result.href)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIndex]) go(results[activeIndex])
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--on-band-muted)] pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search everything…"
          className="w-full pl-9 pr-14 text-sm py-2 bg-[color-mix(in_srgb,var(--on-band)_10%,transparent)] border border-[color-mix(in_srgb,var(--on-band)_20%,transparent)] text-[var(--on-band)] placeholder:text-[var(--on-band-muted)] rounded-[var(--radius-md)] focus:outline-none focus:border-[var(--on-band)] transition-colors"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.65rem] px-1.5 py-0.5 rounded border border-[color-mix(in_srgb,var(--on-band)_20%,transparent)] text-[var(--on-band-muted)] hidden sm:block">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 sm:w-96 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-xl)] max-h-96 overflow-y-auto z-50">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[var(--color-muted)]" /></div>
          ) : results.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] text-center py-6">No results for "{query}"</p>
          ) : (
            <div className="py-1">
              {results.map((r, i) => (
                <button
                  key={`${r.module}-${r.id}`}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                    i === activeIndex ? 'bg-[var(--color-surface-raised)]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-text-primary)] truncate">{r.label || 'Untitled'}</div>
                    {r.sublabel && <div className="text-xs text-[var(--color-muted)] truncate">{r.sublabel}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-[var(--color-muted)]">{r.module}</span>
                    {i === activeIndex && <CornerDownLeft className="w-3 h-3 text-[var(--color-muted)]" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
