'use client'
import { useEffect, useRef, type ReactNode } from 'react'

// A single hairline that draws itself down the page as you scroll and
// retracts as you scroll back up, threading the opening statement into the
// capability grid so the two read as one continuous passage rather than two
// stacked blocks.
//
// Two things make it feel like it comes from nowhere and goes nowhere:
// the line is masked to transparent at both ends, so it never has a visible
// start or stop, and its length is bound directly to scroll position rather
// than triggered once, so reversing the scroll reverses the draw at exactly
// the same rate.
//
// Progress is written to a CSS custom property and consumed by a transform,
// so the only thing changing per frame is a composited scaleY. Nothing here
// reads layout during the scroll handler beyond one getBoundingClientRect,
// and that is inside a rAF.
export default function ScrollThread({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    // Reduced motion gets the finished line, drawn and static: the thread is
    // decoration, and animating it is the part that would be unwelcome.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--thread', '1')
      return
    }

    // Starts drawing when the block's top reaches the lower third of the
    // viewport and completes as its bottom clears the same point, so the
    // line is always drawing in the region the reader is actually looking
    // at rather than racing ahead or lagging behind.
    // The line ends where the "View all capabilities" panel begins rather
    // than running to the bottom of the block, so it reads as arriving at
    // the CTA instead of passing behind it. Measured rather than guessed:
    // the panel's offset depends on how many practice groups the grid holds.
    const stopEl = el.querySelector<HTMLElement>('.capability-cta')

    const compute = () => {
      const rect = el.getBoundingClientRect()
      if (rect.height <= 0) return

      const end = stopEl
        ? stopEl.getBoundingClientRect().top - rect.top
        : rect.height
      el.style.setProperty('--thread-end', `${Math.max(end, 0)}px`)

      // Progress is measured over the line's own run, not the whole block,
      // so it finishes exactly as it reaches the CTA.
      const span = end > 0 ? end : rect.height
      const start = window.innerHeight * 0.66
      const progress = Math.min(Math.max((start - rect.top) / span, 0), 1)
      el.style.setProperty('--thread', progress.toFixed(4))
    }

    // Run once synchronously rather than only scheduling a frame. rAF does
    // not fire in a background tab, so a page opened in one and switched to
    // later would otherwise paint with the property unset until the first
    // scroll.
    compute()

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={wrapRef} className="scroll-thread-wrap">
      {/* Rail mirrors .container so the thread measures against the content
          column rather than the full-bleed wrapper. */}
      <div className="scroll-thread-rail" aria-hidden="true">
        <div className="scroll-thread-inner">
          <span className="scroll-thread" />
        </div>
      </div>
      {children}
    </div>
  )
}
