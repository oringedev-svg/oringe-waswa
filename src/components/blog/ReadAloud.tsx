'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Play, Pause, Square, Volume2, VolumeX, ChevronDown } from 'lucide-react'

interface ReadAloudProps {
  text: string
  title?: string
  compact?: boolean
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const SPEED_LABELS: Record<number, string> = { 0.75: '0.75×', 1: '1×', 1.25: '1.25×', 1.5: '1.5×', 2: '2×' }

// Get all available voices
function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined') return []
  return window.speechSynthesis?.getVoices() || []
}

export default function ReadAloud({ text, title, compact = false }: ReadAloudProps) {
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
  // Tracks which full-text word index playback last started from, so
  // onboundary can report a progress/word position relative to the whole
  // text even though we may only be speaking a slice of it (see speak()).
  const startWordIndexRef = useRef(0)

  // Clean text for reading
  const cleanText = useMemo(() => text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n\n+/g, '. ')
    .replace(/\n/g, ' ')
    .trim(), [text])

  useEffect(() => {
    wordsRef.current = cleanText ? cleanText.split(' ') : []
  }, [cleanText])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stop() {
    window.speechSynthesis?.cancel()
    setPlaying(false)
    setPaused(false)
    setProgress(0)
    setCurrentWordIndex(-1)
    startWordIndexRef.current = 0
  }

  // startWordIndex lets playback begin partway through the text — used for
  // seeking (click on progress bar) and for resuming position after a speed
  // change, since SpeechSynthesisUtterance.rate can't be changed mid-speech.
  function speak(startWordIndex = 0) {
    const words = wordsRef.current
    if (!words.length) return
    window.speechSynthesis?.cancel()

    const clampedStart = Math.max(0, Math.min(startWordIndex, words.length - 1))
    const totalWords = words.length
    const textToSpeak = words.slice(clampedStart).join(' ')
    startWordIndexRef.current = clampedStart

    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.rate = speed
    utterance.volume = muted ? 0 : volume

    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice)
      if (voice) utterance.voice = voice
    }

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const charIndex = e.charIndex
        const localWordsBefore = textToSpeak.slice(0, charIndex).split(' ').length - 1
        const actualWordIndex = clampedStart + localWordsBefore
        setCurrentWordIndex(actualWordIndex)
        setProgress((actualWordIndex / totalWords) * 100)
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
    if (!playing) { speak(0); return }
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
      // Resume from wherever we currently are instead of restarting from
      // the top — rate can't be changed on a live utterance, so we have to
      // stop/restart, but there's no reason to lose the listener's place.
      const resumeFrom = currentWordIndex >= 0 ? currentWordIndex : 0
      window.speechSynthesis?.cancel()
      setTimeout(() => speak(resumeFrom), 100)
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const words = wordsRef.current
    if (!words.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetWordIndex = Math.floor(pct * words.length)
    window.speechSynthesis?.cancel()
    setProgress(pct * 100)
    speak(targetWordIndex)
  }

  if (compact) {
    return (
      <div className="relative inline-block not-prose" onClick={(e) => e.preventDefault()}>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!playing && !paused) {
              togglePause()
            }
            setShowSettings(!showSettings)
          }}
          className="w-10 h-10 bg-white shadow-[var(--shadow-md)] flex items-center justify-center rounded-sm hover:bg-[var(--color-surface-raised)] transition-colors text-[var(--color-brand)]"
          title="Listen to this article"
        >
          {playing && !paused ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {(showSettings || playing) && (
          <div className="absolute top-12 right-0 z-50 w-64 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-xl)] rounded-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePause(); }} className="w-8 h-8 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center hover:bg-[var(--color-brand-dark)] transition-colors flex-shrink-0">
                  {playing && !paused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                {(playing || progress > 0) && (
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); stop(); }} className="w-6 h-6 rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-muted)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors flex-shrink-0">
                    <Square className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="read-aloud-progress flex-1 min-w-0 cursor-pointer h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSeek(e); }}>
                <div className="h-full bg-[var(--color-brand)] transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const nextMuted = !muted
                  setMuted(nextMuted)
                  if (utteranceRef.current) utteranceRef.current.volume = nextMuted ? 0 : volume
                }}
                className="flex-shrink-0 text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors ml-1"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--color-border)]">
               <div className="flex items-center gap-1">
                 {SPEEDS.map(s => (
                   <button key={s} onClick={(e) => { e.preventDefault(); e.stopPropagation(); changeSpeed(s); }} className={`text-[10px] px-1.5 py-1 rounded transition-colors ${speed === s ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text-primary)]'}`}>
                     {SPEED_LABELS[s]}
                   </button>
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="read-aloud-bar not-prose">
      {/* Play/Pause/Stop */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePause}
          className="w-9 h-9 rounded-full bg-[var(--color-brand)] text-white flex items-center justify-center hover:bg-[var(--color-brand-dark)] transition-colors flex-shrink-0"
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

      {/* Progress bar — click to seek to that point in the text */}
      <div
        className="read-aloud-progress flex-1 min-w-0 cursor-pointer"
        onClick={handleSeek}
        title="Click to jump to this point"
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
                ? 'bg-[var(--color-brand)] text-white'
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
          const nextMuted = !muted
          setMuted(nextMuted)
          if (utteranceRef.current) utteranceRef.current.volume = nextMuted ? 0 : volume
        }}
        className="flex-shrink-0 text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Voice selector */}
      {voices.length > 0 && (
        <div className="flex-shrink-0 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"
          >
            Voice <ChevronDown className="w-3 h-3" />
          </button>
          {showSettings && (
            <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-xl)] z-50 max-h-48 overflow-y-auto">
              {voices.filter(v => v.lang.startsWith('en')).map(v => (
                <button
                  key={v.name}
                  onClick={() => {
                    setSelectedVoice(v.name)
                    setShowSettings(false)
                    if (playing) {
                      const resumeFrom = currentWordIndex >= 0 ? currentWordIndex : 0
                      window.speechSynthesis?.cancel()
                      setTimeout(() => speak(resumeFrom), 100)
                    }
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface-overlay)] transition-colors ${selectedVoice === v.name ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)]'}`}
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