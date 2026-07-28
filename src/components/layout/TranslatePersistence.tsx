'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Google's Website Translator rewrites the DOM directly. Next.js client-side
// navigation (every <Link>) re-renders the new route through React, which
// knows nothing about that out-of-band rewrite, so the translation silently
// disappears the moment someone clicks anywhere after the first page. There
// is no in-place fix for that mismatch, Google's widget was built for
// classic multi-page sites. This forces a full document reload on route
// change whenever a non-English language is active, so the freshly loaded
// page gets translated the same way the first one did, at the cost of the
// SPA transition for translated visitors only, everyone browsing in English
// is unaffected.
export default function TranslatePersistence() {
  const pathname = usePathname()
  // Seeded with the CURRENT pathname on first render, not a boolean "have I
  // run yet" flag. React 18 Strict Mode (which next dev runs) invokes
  // effects twice on mount to surface exactly this class of bug: a
  // mounted-flag ref is already true by the second synthetic invocation,
  // so a "skip the first run" guard fires on that second call anyway, with
  // no real navigation involved, reloading the page immediately, and on
  // the fresh mount it produces, doing the same thing again. Comparing
  // actual pathname values instead of a flag is immune to that: the
  // second Strict Mode invocation sees the same pathname it just recorded
  // and does nothing, only a real change in the URL ever counts.
  const prevPathname = useRef(pathname)

  useEffect(() => {
    const changed = prevPathname.current !== pathname
    prevPathname.current = pathname
    if (!changed) return

    const active = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/)?.[1]
    if (active && active !== 'en') {
      window.location.reload()
    }
  }, [pathname])

  return null
}
