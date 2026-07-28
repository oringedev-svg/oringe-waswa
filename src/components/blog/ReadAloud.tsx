'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Volume2, VolumeX, ChevronDown, RotateCcw } from 'lucide-react'

interface ReadAloudProps {
  text: string
  title?: string
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const SPEED_LABELS: Record<number, string> = { 0.75: '0.75×', 1: '1×', 1.25: '1.25×', 1.5: '1.5×', 2: '2×' }

// Get all available voices
function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined') return []
  return window.speechSynthesis?.getVoices() || []
}

export default function ReadAloud({ text, title }: ReadAloudProps) {
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const wordsRef = useRef<string[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean text for reading
  const cleanText = text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, ' ')
    .trim()

  useEffect(() => {
    const loadVoices = () => {
      const v = getVoices()
      setVoices(v)
      // Prefer English voices
      const enVoice = v.find(v => v.lang.startsWith('en-') && v.name.includes('Natural'))
        || v.find(v => v.lang.startsWith('en-'))
      if (enVoice && !selectedVoice) setSelectedVoice(enVoice.name)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    return () => {
      stop()
    }
  }, [])

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    window.speechSynthesis?.cancel()
    setPlaying(false)
    setPaused(false)
    setProgress(0)
    setCurrentWordIndex(-1)
  }

  function speak() {
    if (!cleanText) return
    window.speechSynthesis?.cancel()

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = speed
    utterance.volume = muted ? 0 : volume

    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice)
      if (voice) utterance.voice = voice
    }

    wordsRef.current = cleanText.split(' ')
    const totalWords = wordsRef.current.length

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const charIndex = e.charIndex
        const wordsBefore = cleanText.slice(0, charIndex).split(' ').length - 1
        setCurrentWordIndex(wordsBefore)
        setProgress((wordsBefore / totalWords) * 100)
      }
    }

    utterance.onend = () => {
      setPlaying(false)
      setPaused(false)
      setProgress(100)
      setCurrentWordIndex(-1)
    }

    utterance.onerror = () => {
      setPlaying(false)
      setPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis?.speak(utterance)
    setPlaying(true)
    setPaused(false)
  }

  function togglePause() {
    if (!playing) { speak(); return }
    if (paused) {
      window.speechSynthesis?.resume()
      setPaused(false)
    } else {
      window.speechSynthesis?.pause()
      setPaused(true)
    }
  }

  function changeSpeed(s: number) {
    setSpeed(s)
    if (playing) {
      stop()
      setTimeout(() => speak(), 100)
    }
  }

  return (
    <div className="read-aloud-bar not-prose">
      {/* Play/Pause/Stop */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePause}
          className="w-9 h-9 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center hover:bg-[var(--color-accent-dark)] transition-colors flex-shrink-0"
          title={playing && !paused ? 'Pause' : 'Play'}
        >
          {playing && !paused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {(playing || progress > 0) && (
          <button
            onClick={stop}
            className="w-7 h-7 rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-muted)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors flex-shrink-0"
            title="Stop"
          >
            <Square className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Label */}
      <div className="flex-shrink-0">
        <div className="text-xs font-medium text-[var(--color-text-primary)]">
          {playing ? (paused ? 'Paused' : 'Reading…') : 'Read Aloud'}
        </div>
        {title && <div className="text-xs text-[var(--color-muted)] truncate max-w-32">{title}</div>}
      </div>

      {/* Progress bar */}
      <div
        className="read-aloud-progress flex-1 min-w-0"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          const charPos = Math.floor(pct * cleanText.length)
          stop()
          // seek not natively supported, just restart
        }}
      >
        <div className="read-aloud-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => changeSpeed(s)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              speed === s
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Volume */}
      <button
        onClick={() => {
          setMuted(!muted)
          if (utteranceRef.current) utteranceRef.current.volume = muted ? volume : 0
        }}
        className="flex-shrink-0 text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Voice selector */}
      {voices.length > 0 && (
        <div className="flex-shrink-0 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            Voice <ChevronDown className="w-3 h-3" />
          </button>
          {showSettings && (
            <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-xl)] z-50 max-h-48 overflow-y-auto">
              {voices.filter(v => v.lang.startsWith('en')).map(v => (
                <button
                  key={v.name}
                  onClick={() => { setSelectedVoice(v.name); setShowSettings(false); if (playing) { stop(); setTimeout(speak, 100) } }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface-overlay)] transition-colors ${selectedVoice === v.name ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
                >
                  {v.name} <span className="text-[var(--color-muted)]">({v.lang})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
