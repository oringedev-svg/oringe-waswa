'use client'
import { useState, useRef, useEffect } from 'react'
import PublicLayout from '@/components/layout/PublicLayout'
import { Send, Loader2, CheckCircle, Bot, User, Sparkles, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import FaqSection from '@/components/contact/FaqSection'

// Job applications are NOT handled here. Careers owns that flow end to end
// (per-vacancy apply, with the opening's own context attached); a second,
// context-free "Job Application" tab on Contact only split applications
// across two inboxes and asked the candidate which door to use.
type FormType = 'contact' | 'paper'

interface ChatMsg {
  role: 'ai' | 'user'
  content: string
  field?: string
  options?: string[]
  inputType?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'options'
}

interface FormData { [key: string]: string }

const FORM_FLOWS: Record<FormType, ChatMsg[]> = {
  contact: [
    { role: 'ai', content: "Hello! I'm the Oringe Waswa virtual assistant. I'll help route your message to the right team. What's your full name?", field: 'name', inputType: 'text' },
    { role: 'ai', content: "Nice to meet you, {name}! What's your email address?", field: 'email', inputType: 'email' },
    { role: 'ai', content: "Phone number? (Optional, press Enter to skip)", field: 'phone', inputType: 'tel' },
    { role: 'ai', content: "Which town or county is this based in? (Optional, press Enter to skip)", field: 'county', inputType: 'text' },
    { role: 'ai', content: "What type of legal matter is this about?", field: 'matter_type', inputType: 'options', options: ['Civil Litigation', 'Criminal Defense', 'Family Law', 'Corporate Law', 'Property Law', 'Immigration', 'Employment Law', 'General Inquiry'] },
    { role: 'ai', content: "Please describe your matter in detail:", field: 'message', inputType: 'textarea' },
  ],
  paper: [
    { role: 'ai', content: "Welcome to the OW paper submission portal! What's your full name?", field: 'name', inputType: 'text' },
    { role: 'ai', content: "What's your email, {name}?", field: 'email', inputType: 'email' },
    { role: 'ai', content: "What is the title of your paper?", field: 'paper_title', inputType: 'text' },
    { role: 'ai', content: "What legal field does your paper cover?", field: 'field', inputType: 'options', options: ['Constitutional Law', 'Civil Litigation', 'Corporate Law', 'Criminal Law', 'Family Law', 'Property Law', 'Human Rights', 'International Law', 'Technology Law', 'Other'] },
    { role: 'ai', content: "Please provide a brief abstract (2-5 sentences):", field: 'message', inputType: 'textarea' },
    { role: 'ai', content: "List your keywords (comma-separated):", field: 'keywords', inputType: 'text' },
  ],
}

const TABS: { key: FormType; label: string }[] = [
  { key: 'contact', label: 'Contact Us' },
  { key: 'paper', label: 'Paper Submission' },
]

export default function ContactPage() {
  const [formType, setFormType] = useState<FormType>('contact')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<FormData>({})
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ trackingCode: string } | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { resetForm(formType) }, [formType])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function resetForm(type: FormType) {
    const flow = FORM_FLOWS[type]
    setMessages([flow[0]])
    setCurrentStep(0)
    setFormData({})
    setInputValue('')
    setDone(null)
    setAiAnalyzing(false)
    setSubmitting(false)
  }

  function interpolate(text: string, data: FormData) {
    return text.replace(/\{(\w+)\}/g, (_, key) => data[key] || '')
  }

  async function handleSubmit(value?: string) {
    const val = (value !== undefined ? value : inputValue).trim()
    const flow = FORM_FLOWS[formType]
    const currentQ = flow[currentStep]
    if (!val && currentQ?.field !== 'phone' && currentQ?.field !== 'links' && currentQ?.field !== 'county') return

    const fieldValue = val || '(skipped)'
    const updatedData = { ...formData, [currentQ.field!]: fieldValue }
    setFormData(updatedData)
    setMessages(prev => [...prev, { role: 'user', content: val || '(skipped)' }])
    setInputValue('')

    const nextStep = currentStep + 1
    if (nextStep < flow.length) {
      setMessages(prev => [...prev, { role: 'ai', content: '...', inputType: 'text' }])
      await new Promise(r => setTimeout(r, 600))
      const nextQ = flow[nextStep]
      setMessages(prev => [...prev.slice(0, -1), { ...nextQ, content: interpolate(nextQ.content, updatedData) }])
      setCurrentStep(nextStep)
    } else {
      await submitForm(updatedData)
    }
  }

  async function submitForm(data: FormData) {
    setAiAnalyzing(true)
    setMessages(prev => [...prev, { role: 'ai', content: 'Analyzing your submission and routing to the right team...' }])

    try {
      // AI analysis for smart routing
      const aiRes = await fetch('/api/ai/analyze-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formType, data }),
      })
      const aiData = aiRes.ok ? await aiRes.json() : {}

      let finalType = formType
      if (aiData.suggested_type && aiData.suggested_type !== formType && (aiData.confidence || 0) > 0.7) {
        finalType = aiData.suggested_type
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `Based on your message, I've routed this to our **${finalType.replace(/_/g, ' ')}** team for the best response.`
        }])
        await new Promise(r => setTimeout(r, 800))
      }

      setAiAnalyzing(false)
      setSubmitting(true)

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: finalType,
          submitter_name: data.name,
          submitter_email: data.email,
          submitter_phone: data.phone,
          data,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Almost there, ${data.name}! We've sent a confirmation link to **${data.email}** — click it to complete your submission (tracking code **${result.trackingCode}**). We'll respond within 1-3 business days of confirmation.`
      }])
      setDone({ trackingCode: result.trackingCode })
    } catch {
      toast.error('Submission failed. Please try again.')
      setMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, there was an error. Please try again or email us directly." }])
    } finally {
      setAiAnalyzing(false)
      setSubmitting(false)
    }
  }

  const currentQ = FORM_FLOWS[formType][currentStep]
  const lastMessage = messages[messages.length - 1]
  const showInput = !done && !submitting && !aiAnalyzing && lastMessage?.role === 'ai' && lastMessage?.content !== '...'

  return (
    <PublicLayout>
      <div className="py-20 reveal" style={{ background: 'var(--color-surface-raised)' }}>
        <div className="container">
          <span className="eyebrow mb-4 block">Get In Touch</span>
          <h1 className="font-display font-light mb-3" style={{ fontSize: 'var(--heading-page-size)' }}>Contact and Apply</h1>
          <p className="text-[var(--color-text-muted)] max-w-xl">Chat with our AI assistant. Submissions are automatically analyzed and routed to the right team.</p>
        </div>
      </div>

      <div className="section">
        <div className="container max-w-3xl">
          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setFormType(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  formType === tab.key
                    ? 'bg-[var(--color-accent)] text-white shadow-md'
                    : 'bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden reveal-scale">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]" style={{ background: 'var(--color-text-primary)' }}>
              <div className="w-9 h-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm" style={{ color: 'var(--color-primary-900)' }}>OW Legal Assistant</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>AI-Powered · Smart Routing</span>
                </div>
              </div>
              <button onClick={() => resetForm(formType)} className="ml-auto btn btn-ghost p-1.5 !px-1.5 text-[var(--color-muted)]">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 min-h-80 max-h-[500px] overflow-y-auto flex flex-col gap-0">
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
                            {line.split('**').map((part, pi) => pi % 2 === 1 ? <strong key={pi}>{part}</strong> : part)}
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
                  <textarea
                    rows={currentQ?.inputType === 'textarea' ? 3 : 1}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && currentQ?.inputType !== 'textarea') {
                        e.preventDefault(); handleSubmit()
                      }
                    }}
                    placeholder={
                      currentQ?.inputType === 'email' ? 'your@email.com' :
                      currentQ?.inputType === 'tel' ? '+254 700 000 000 (Enter to skip)' :
                      currentQ?.field === 'county' ? 'e.g. Nairobi (Enter to skip)' :
                      currentQ?.inputType === 'textarea' ? 'Type your message… (Shift+Enter = new line)' :
                      'Type your answer…'
                    }
                    className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-muted)]"
                    style={{ minHeight: '24px', maxHeight: '120px' }}
                    autoFocus
                  />
                  <button onClick={() => handleSubmit()}
                    disabled={!inputValue.trim() && currentQ?.field !== 'phone' && currentQ?.field !== 'links' && currentQ?.field !== 'county'}
                    className="btn btn-primary !p-2.5 flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {(submitting || aiAnalyzing) && (
              <div className="p-4 border-t border-[var(--color-border)] flex items-center gap-3 text-sm text-[var(--color-muted)]">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                {aiAnalyzing ? 'AI is analyzing and routing your submission…' : 'Submitting…'}
              </div>
            )}

            {done && (
              <div className="p-5 border-t border-[var(--color-border)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-[var(--color-text-primary)]">Confirm your email to finish</p>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">We've emailed you a confirmation link — your submission isn't complete until you click it.</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-[var(--color-muted)]">Tracking:</span>
                        <code className="text-xs font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded">{done.trackingCode}</code>
                      </div>
                    </div>
                  </div>
                  <a href={`/track?code=${done.trackingCode}`} className="btn btn-outline text-sm flex-shrink-0">Track Status</a>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 reveal">
            {[
              { title: 'Smart AI Routing', desc: 'Your inquiry is analyzed and sent to the right attorney automatically.' },
              { title: 'Fully Confidential', desc: 'Protected by attorney-client privilege.' },
              { title: 'Email Confirmation', desc: "You'll receive a tracking code and updates by email." },
            ].map(({ title, desc }) => (
              <div key={title} className="card p-4 text-center">
                <h3 className="font-semibold text-sm text-[var(--color-text-primary)] mb-1">{title}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
              </div>
            ))}
          </div>

          <FaqSection />
        </div>
      </div>
    </PublicLayout>
  )
}
