'use client'

import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// iOS Safari never fires beforeinstallprompt -- Apple has never implemented
// it -- so an iPhone/iPad visitor would otherwise see no install path at
// all. Detected by user agent rather than feature-testing, there is no
// capability to test for here; "iPad" is included since iPadOS Safari
// still identifies as one on many devices/versions.
function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

// Both the standard (matchMedia) and iOS-specific (navigator.standalone)
// signals, since older iOS only exposes the latter.
function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export default function InstallAppButton({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [iosEligible, setIosEligible] = useState(false)

  useEffect(() => {
    const receivePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent) }
    const markInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', receivePrompt)
    window.addEventListener('appinstalled', markInstalled)
    setIosEligible(isIOS() && !isStandalone())
    return () => { window.removeEventListener('beforeinstallprompt', receivePrompt); window.removeEventListener('appinstalled', markInstalled) }
  }, [])

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  if (installed) return null

  if (prompt) {
    return (
      <button type="button" onClick={install} className={`install-app-button ${className}`}>
        <Download className="w-3.5 h-3.5" /> Install app
      </button>
    )
  }

  if (iosEligible) {
    return (
      <div className="relative">
        <button type="button" onClick={() => setShowIOSInstructions((v) => !v)} className={`install-app-button ${className}`}>
          <Download className="w-3.5 h-3.5" /> Install app
        </button>
        {showIOSInstructions && (
          <div className="install-app-ios-popover" role="dialog" aria-label="Install on iPhone or iPad">
            <button type="button" onClick={() => setShowIOSInstructions(false)} aria-label="Close" className="install-app-ios-close">
              <X className="w-3.5 h-3.5" />
            </button>
            <p className="install-app-ios-step">
              <Share className="w-4 h-4 flex-shrink-0" /> Tap <strong>Share</strong> in Safari's toolbar
            </p>
            <p className="install-app-ios-step">
              <SquarePlus className="w-4 h-4 flex-shrink-0" /> Then choose <strong>Add to Home Screen</strong>
            </p>
          </div>
        )}
      </div>
    )
  }

  return null
}
