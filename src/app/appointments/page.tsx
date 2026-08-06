'use client'
import { useState, useRef, useEffect } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Calendar, Bot, User, Send, Loader2, CheckCircle, Sparkles, RefreshCw, Clock, Shield, Phone } from 'lucide-react'
import toast from 'react-hot-toast'
import { MATTER_TYPES } from '@/lib/utils'

interface ChatMsg {
  role: 'ai' | 'user'
  content: string
  field?: string
  options?: string[]
  inputType?: 'text' | 'email' | 'tel' | 'date' | 'options'
}

interface FormData { [key: string]: string }

const FLOW: ChatMsg[] = [
  { role: 'ai', content: "Hello! I'll help you book a consultation with one of our attorneys. What's your full name?", field: 'client_name', inputType: 'text' },
  { role: 'ai', content: "Great, {client_name}! What's your email address?", field: 'client_email', inputType: 'email' },
  { role: 'ai', content: "Phone number? (Optional, press Enter to skip)", field: 'client_phone', inputType: 'tel' },
  { role: 'ai', content: "Which town or county is this based in? (Optional, press Enter to skip)", field: 'county', inputType: 'text' },
  { role: 'ai', content: "What type of legal matter do you need help with?", field: 'matter_type', inputType: 'options', options: MATTER_TYPES.map(m => m.label) },
  { role: 'ai', content: "Please briefly describe your matter:", field: 'description', inputType: 'text' },
  { role: 'ai', content: "What date would you prefer? (YYYY-MM-DD)", field: 'preferred_date', inputType: 'date' },
  { role: 'ai', content: "What time works best for you?", field: 'preferred_time', inputType: 'options', options: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
  { role: 'ai', content: "Would you prefer in-person or virtual?", field: 'is_virtual', inputType: 'options', options: ['In-Person (Nairobi Office)', 'Virtual (Video/Phone)'] },
]

export default function AppointmentsPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([FLOW[0]])
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<FormData>({})
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ trackingCode: string } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function interpolate(text: string, data: FormData) {
    return text.replace(/\{(\w+)\}/g, (_, k) => data[k] || '')
  }

  async function handleSubmit(val?: string) {
    const value = (val !== undefined ? val : input).trim()
    const q = FLOW[step]
    if (!value && q.field !== 'client_phone' && q.field !== 'county') return

    const fieldValue = value || '(skipped)'
    const updated = { ...formData, [q.field!]: fieldValue }
    setFormData(updated)
    setMessages(prev => [...prev, { role: 'user', content: val || input || '(skipped)' }])
    setInput('')

    const next = step + 1
    if (next < FLOW.length) {
      setMessages(prev => [...prev, { role: 'ai', content: '...' }])
      await new Promise(r => setTimeout(r, 600))
      const nextQ = FLOW[next]
      setMessages(prev => [...prev.slice(0, -1), { ...nextQ, content: interpolate(nextQ.content, updated) }])
      setStep(next)
    } else {
      await submit(updated)
    }
  }

  async function submit(data: FormData) {
    setSubmitting(true)
    setMessages(prev => [...prev, { role: 'ai', content: 'Booking your appointment…' }])
    try {
      const matterType = MATTER_TYPES.find(m => m.label === data.matter_type)?.value || 'other'

      // Create submission
      const subRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          submitter_name: data.client_name,
          submitter_email: data.client_email,
          submitter_phone: data.client_phone,
          data,
        }),
      })
      const subData = await subRes.json()
      if (!subRes.ok) throw new Error(subData.error)

      // Create appointment
      await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: subData.submission.id,
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone,
          matter_type: matterType,
          description: data.description,
          status: 'pending',
          scheduled_date: data.preferred_date,
          scheduled_time: data.preferred_time,
          location: data.is_virtual?.includes('Virtual') ? null : 'Nairobi Office',
          meeting_link: data.is_virtual?.includes('Virtual') ? 'Will be provided upon confirmation' : null,
        }),
      })

      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Almost there, ${data.client_name}! We've sent a confirmation link to **${data.client_email}** — click it to secure this booking (tracking code **${subData.trackingCode}**). Our team will confirm within 1 business day of that.`
      }])
      setDone({ trackingCode: subData.trackingCode })
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Booking failed')
      setMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, there was an issue. Please try again or call us directly." }])
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setMessages([FLOW[0]])
    setStep(0)
    setFormData({})
    setInput('')
    setDone(null)
    setSubmitting(false)
  }

  const lastMessage = messages[messages.length - 1]
  const showInput = !done && !submitting && lastMessage?.role === 'ai' && lastMessage?.content !== '...'
  const currentQ = FLOW[step]

  return (
    <PublicLayout>
      <div className="py-20 reveal" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Get Started</span>
          <h1 className="font-display font-light mb-4" style={{ fontSize: 'var(--heading-page-size)' }}>Book a Consultation</h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 max-w-2xl">
            {[
              { icon: Calendar, label: 'Flexible Scheduling', desc: 'Mon–Fri, 8am–5pm' },
              { icon: Clock, label: 'Duration', desc: '60–90 minutes' },
              { icon: Shield, label: 'Confidential', desc: 'Attorney-client privilege' },
              { icon: Phone, label: 'Virtual Available', desc: 'Video/phone options' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-sm bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
                  <div className="text-xs text-[var(--color-muted)]">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="container max-w-2xl">
          <div className="card overflow-hidden reveal-scale">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]" style={{ background: 'var(--color-text-primary)' }}>
              <div className="w-9 h-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--color-primary-900)' }}>Appointment Booking</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Step {Math.min(step + 1, FLOW.length)} of {FLOW.length}</span>
                </div>
              </div>
              <button onClick={reset} className="ml-auto btn btn-ghost p-1.5 !px-1.5 text-[var(--color-muted)]">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 min-h-80 max-h-[480px] overflow-y-auto flex flex-col gap-0">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role === 'user' ? 'user' : ''}`}>
                  {msg.role === 'ai' ? (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-surface-overlay)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-[var(--color-muted)]" />
                    </div>
                  )}
                  <div>
                    {msg.content === '...' ? (
                      <div className="chat-bubble ai"><div className="chat-typing"><span /><span /><span /></div></div>
                    ) : (
                      <div className={`chat-bubble ${msg.role === 'ai' ? 'ai' : 'user'}`}>
                        {msg.content.split('\n').map((line, li) => (
                          <span key={li}>
                            {line.split('**').map((p, pi) => pi % 2 === 1 ? <strong key={pi}>{p}</strong> : p)}
                            {li < msg.content.split('\n').length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.role === 'ai' && msg.inputType === 'options' && msg.options && i === messages.length - 1 && showInput && (
                      <div className="flex flex-wrap gap-2 mt-2 ml-1">
                        {msg.options.map(opt => (
                          <button key={opt} onClick={() => handleSubmit(opt)}
                            className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)] hover:text-white hover:border-[var(--color-accent)] transition-all">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {showInput && currentQ?.inputType !== 'options' && (
              <div className="p-4 border-t border-[var(--color-border)]">
                <div className="chat-input-area">
                  <input
                    type={currentQ?.inputType === 'date' ? 'date' : currentQ?.inputType === 'email' ? 'email' : currentQ?.inputType === 'tel' ? 'tel' : 'text'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
                    placeholder={
                      currentQ?.inputType === 'email' ? 'your@email.com' :
                      currentQ?.inputType === 'tel' ? '+254 700 000 000 (Enter to skip)' :
                      currentQ?.inputType === 'date' ? 'YYYY-MM-DD' :
                      currentQ?.field === 'county' ? 'e.g. Nairobi (Enter to skip)' :
                      'Type your answer…'
                    }
                    min={currentQ?.inputType === 'date' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : undefined}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-muted)]"
                    autoFocus
                  />
                  <button onClick={() => handleSubmit()}
                    disabled={!input.trim() && currentQ?.field !== 'client_phone' && currentQ?.field !== 'county'}
                    className="btn btn-primary !p-2.5 flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {submitting && (
              <div className="p-4 border-t border-[var(--color-border)] flex items-center gap-3 text-sm text-[var(--color-muted)]">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                Booking your appointment…
              </div>
            )}

            {done && (
              <div className="p-5 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-4">
                  <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-[var(--color-text-primary)]">Appointment Request Sent!</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--color-muted)]">Tracking:</span>
                      <code className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded">{done.trackingCode}</code>
                    </div>
                  </div>
                  <a href={`/track?code=${done.trackingCode}`} className="btn btn-outline text-sm flex-shrink-0">Track</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
