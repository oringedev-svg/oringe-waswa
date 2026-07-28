'use client'
import { useEffect, useState } from 'react'
import { Award, Plus, Send, Loader2, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Certificate {
  id: string
  type: string
  title: string
  description?: string
  issued_date: string
  is_sent: boolean
  recipient: { full_name: string; email: string }
}

interface Profile { id: string; full_name: string; email: string }

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showIssue, setShowIssue] = useState(false)
  const [issueForm, setIssueForm] = useState({
    recipient_id: '',
    type: 'participation',
    title: '',
    description: '',
    send_email: true,
  })
  const [issuing, setIssuing] = useState(false)

  async function load() {
    const [certsRes, peopleRes] = await Promise.all([
      fetch('/api/certificates').then(r => r.json()),
      fetch('/api/people?limit=200').then(r => r.json()),
    ])
    setCerts(certsRes || [])
    setPeople(peopleRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function issueCertificate() {
    if (!issueForm.recipient_id || !issueForm.title) { toast.error('Recipient and title required'); return }
    setIssuing(true)
    try {
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueForm),
      })
      if (res.ok) {
        toast.success(issueForm.send_email ? 'Certificate issued and sent!' : 'Certificate issued!')
        setShowIssue(false)
        setIssueForm({ recipient_id: '', type: 'participation', title: '', description: '', send_email: true })
        load()
      } else toast.error('Failed to issue certificate')
    } catch { toast.error('Network error') }
    finally { setIssuing(false) }
  }

  const certTypeLabels: Record<string, string> = {
    participation: 'Certificate of Participation',
    achievement: 'Certificate of Achievement',
    custom: 'Custom Certificate',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Certificates</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Issue and manage certificates for participants, achievements, and more</p>
        </div>
        <button onClick={() => setShowIssue(true)} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> Issue Certificate
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : certs.length === 0 ? (
        <div className="card p-12 text-center">
          <Award className="w-12 h-12 text-[var(--color-muted)]/30 mx-auto mb-3" />
          <p className="text-[var(--color-muted)]">No certificates issued yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map(cert => (
            <div key={cert.id} className="card p-5 relative overflow-hidden">
              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--color-accent)]/5 rounded-bl-full" />
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-10 h-10 rounded-sm bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-[var(--color-accent)]" />
                </div>
                {cert.is_sent ? (
                  <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3.5 h-3.5" />Sent</span>
                ) : (
                  <span className="badge status-pending text-xs">Not Sent</span>
                )}
              </div>
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-1">{cert.title}</h3>
              <p className="text-xs text-[var(--color-accent)] font-medium mb-2">{certTypeLabels[cert.type] || cert.type}</p>
              <div className="text-xs text-[var(--color-muted)]">
                <div>Recipient: <span className="text-[var(--color-text-secondary)] font-medium">{cert.recipient?.full_name}</span></div>
                <div>Issued: {formatDate(cert.issued_date, 'long')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue Modal */}
      {showIssue && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowIssue(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-lg shadow-[var(--shadow-xl)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <Award className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">Issue Certificate</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Recipient *</label>
                <select className="input text-sm" value={issueForm.recipient_id} onChange={e => setIssueForm(f => ({ ...f, recipient_id: e.target.value }))}>
                  <option value="">Select recipient…</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.full_name}, {p.email}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Certificate Type</label>
                <select className="input text-sm" value={issueForm.type} onChange={e => setIssueForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(certTypeLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Certificate Title *</label>
                <input className="input text-sm" value={issueForm.title} onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Certificate of Volunteer Excellence" />
              </div>
              <div>
                <label className="label">Achievement Description</label>
                <textarea rows={3} className="input text-sm" value={issueForm.description} onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what was achieved… (AI will enhance this)" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={issueForm.send_email} onChange={e => setIssueForm(f => ({ ...f, send_email: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">Send certificate to recipient via email (with permission)</span>
              </label>
              <div className="flex gap-3">
                <button onClick={issueCertificate} disabled={issuing} className="btn btn-primary flex-1 gap-2">
                  {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  Issue Certificate
                </button>
                <button onClick={() => setShowIssue(false)} className="btn btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
