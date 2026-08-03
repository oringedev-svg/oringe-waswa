'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function InstallAppButton({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const receivePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent) }
    const markInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', receivePrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', receivePrompt); window.removeEventListener('appinstalled', markInstalled) }
  }, [])

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  if (!prompt || installed) return null
  return <button type="button" onClick={install} className={`install-app-button ${className}`}><Download className="w-3.5 h-3.5" /> Install app</button>
}
