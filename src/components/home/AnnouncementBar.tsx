'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, X, ArrowRight } from 'lucide-react'

// Renders only when a news item has actually been pushed to announcement in
// the admin. No announcement means this section does not exist at all, not
// an empty placeholder.
interface Announcement {
  id: string
  title: string
  description?: string
  external_url?: string
  category?: string
}

// No client-side fetch here any more, the announcement (if any) arrives
// server-fetched from the homepage; dismissal state still has to be
// client-side, it lives in sessionStorage.
export default function AnnouncementBar({ initialAnnouncement }: { initialAnnouncement: Announcement | null }) {
  const item = initialAnnouncement
  const [dismissed, setDismissed] = useState(false)

  // Dismissal is remembered per announcement, so pushing a new one shows
  // again even for someone who closed the previous banner.
  useEffect(() => {
    if (!item) return
    try {
      if (sessionStorage.getItem(`owa-dismissed-${item.id}`)) setDismissed(true)
    } catch { /* private mode, just leave it visible */ }
  }, [item])

  function dismiss() {
    setDismissed(true)
    if (item) {
      try { sessionStorage.setItem(`owa-dismissed-${item.id}`, '1') } catch { /* ignore */ }
    }
  }

  if (!item || dismissed) return null

  // Deep-link to the announced item, not the whole roundup. Insights have no
  // detail route of their own, so an external_url wins where one is set and
  // otherwise this anchors to that item's card on the insights page rather
  // than dropping the reader at the top of a list to hunt for it.
  const href = item.external_url || `/insights#${item.id}`

  return (
    <aside className="announcement-bar" role="region" aria-label="Announcement">
      <div className="container announcement-bar-inner">
        <Megaphone className="announcement-bar-icon" aria-hidden="true" />
        <div className="announcement-bar-body">
          {item.category && <span className="announcement-bar-tag">{item.category}</span>}
          <span className="announcement-bar-title">{item.title}</span>
        </div>
        <Link href={href} className="announcement-bar-link">
          Read more <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button onClick={dismiss} className="announcement-bar-close" aria-label="Dismiss announcement">
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
