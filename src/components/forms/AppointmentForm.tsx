'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Calendar, CheckCircle, Loader2, Sparkles } from 'lucide-react'
import { MATTER_TYPES } from '@/lib/utils'

const schema = z.object({
  client_name: z.string().min(2, 'Name is required'),
  client_email: z.string().email('Valid email required'),
  client_phone: z.string().optional(),
  matter_type: z.string().min(1, 'Please select a matter type'),
  description: z.string().min(20, 'Please describe your matter (min 20 characters)'),
  preferred_date: z.string().min(1, 'Please select a preferred date'),
  preferred_time: z.string().min(1, 'Please select a preferred time'),
  is_virtual: z.boolean().default(false),
})

type FormData = z.infer<typeof schema>

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

export default function AppointmentForm() {
  const [submitted, setSubmitted] = useState<{ trackingCode: string } | null>(null)
  const [aiSuggesting, setAiSuggesting] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_virtual: false },
  })

  const descriptionValue = watch('description')
  const matterTypeValue = watch('matter_type')

  async function getAISuggestion() {
    if (!matterTypeValue) { toast.error('Select a matter type first'); return }
    setAiSuggesting(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `I need help describing my ${matterTypeValue.replace(/_/g, ' ')} legal matter for a consultation booking. Can you give me a template of what key information I should include in my description? Keep it brief, 2-3 sentences as a template.`,
          }],
        }),
      })
      const data = await res.json()
      if (data.response) setValue('description', data.response)
    } catch {
      toast.error('AI suggestion unavailable')
    } finally {
      setAiSuggesting(false)
    }
  }

  async function onSubmit(data: FormData) {
    try {
      // First create submission
      const subRes = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'appointment',
          submitter_name: data.client_name,
          submitter_email: data.client_email,
          submitter_phone: data.client_phone,
          data: {
            matter_type: data.matter_type,
            description: data.description,
            preferred_date: data.preferred_date,
            preferred_time: data.preferred_time,
            is_virtual: data.is_virtual,
          },
        }),
      })
      const subData = await subRes.json()
      if (!subRes.ok) throw new Error(subData.error)

      // Then create appointment record
      await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: subData.submission.id,
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone,
          matter_type: data.matter_type,
          description: data.description,
          status: 'pending',
          scheduled_date: data.preferred_date,
          scheduled_time: data.preferred_time,
          location: data.is_virtual ? null : 'Nairobi Office',
          meeting_link: data.is_virtual ? 'Will be provided upon confirmation' : null,
        }),
      })

      setSubmitted({ trackingCode: subData.trackingCode })
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Submission failed')
    }
  }

  if (submitted) {
    return (
      <div className="card p-10 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
        <h2 className="font-display text-2xl font-semibold mb-3 text-[var(--color-text-primary)]">Appointment Request Received!</h2>
        <p className="text-[var(--color-text-muted)] mb-6">
          We'll confirm your appointment within 1 business day. A confirmation email has been sent.
        </p>
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-4 mb-6">
          <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">Your Tracking Code</p>
          <p className="font-mono text-2xl font-bold text-[var(--color-accent)] tracking-widest">{submitted.trackingCode}</p>
        </div>
        <a href={`/track?code=${submitted.trackingCode}`} className="btn btn-outline">Track Your Appointment</a>
      </div>
    )
  }

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">Consultation Request</h2>
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name *</label>
          <input {...register('client_name')} className="input" placeholder="Your full name" />
          {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name.message}</p>}
        </div>
        <div>
          <label className="label">Email Address *</label>
          <input {...register('client_email')} type="email" className="input" placeholder="your@email.com" />
          {errors.client_email && <p className="text-xs text-red-500 mt-1">{errors.client_email.message}</p>}
        </div>
        <div>
          <label className="label">Phone Number</label>
          <input {...register('client_phone')} className="input" placeholder="+254 700 000 000" />
        </div>
        <div>
          <label className="label">Matter Type *</label>
          <select {...register('matter_type')} className="input">
            <option value="">Select matter type…</option>
            {MATTER_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {errors.matter_type && <p className="text-xs text-red-500 mt-1">{errors.matter_type.message}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Brief Description *</label>
          <button type="button" onClick={getAISuggestion} disabled={aiSuggesting}
            className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline">
            {aiSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Template
          </button>
        </div>
        <textarea {...register('description')} rows={4} className="input" placeholder="Briefly describe your legal matter…" />
        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Preferred Date *</label>
          <input {...register('preferred_date')} type="date" min={minDate} className="input" />
          {errors.preferred_date && <p className="text-xs text-red-500 mt-1">{errors.preferred_date.message}</p>}
        </div>
        <div>
          <label className="label">Preferred Time *</label>
          <select {...register('preferred_time')} className="input">
            <option value="">Select time…</option>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {errors.preferred_time && <p className="text-xs text-red-500 mt-1">{errors.preferred_time.message}</p>}
        </div>
      </div>

      {/* Virtual option */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" {...register('is_virtual')} className="w-4 h-4 accent-[var(--color-accent)]" />
        <span className="text-sm text-[var(--color-text-secondary)]">I prefer a virtual (video/phone) consultation</span>
      </label>

      <button type="submit" disabled={isSubmitting} className="btn btn-primary gap-2 py-4">
        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Request Appointment'}
      </button>

      <p className="text-xs text-center text-[var(--color-muted)]">
        Your information is protected by attorney-client privilege and our privacy policy.
      </p>
    </form>
  )
}
