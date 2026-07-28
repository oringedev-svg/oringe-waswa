'use client'
import { useEffect } from 'react'

// Every scroll-animated primitive shares one class list so a single observer
// drives them all: text reveals (.reveal*) and growing rules (.grow-line*).
const SELECTOR = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .grow-line, .grow-line-left, .grow-line-v'

export default function ScrollRevealProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Bidirectional: content eases in on enter and eases back out on
          // leave, so scrolling either direction feels animated, text and
          // lines appear and disappear rather than latching once.
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          } else if (!reduce) {
            entry.target.classList.remove('visible')
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -12% 0px' }
    )

    const observeAll = () => document.querySelectorAll(SELECTOR).forEach((el) => observer.observe(el))
    observeAll()

    // Re-observe elements added on route changes / async renders.
    const mutObs = new MutationObserver(observeAll)
    mutObs.observe(document.body, { childList: true, subtree: true })

    // Reduced-motion users get everything shown immediately, no motion.
    if (reduce) document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('visible'))

    return () => { observer.disconnect(); mutObs.disconnect() }
  }, [])

  return <>{children}</>
}
