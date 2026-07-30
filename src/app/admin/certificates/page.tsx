'use client'
import { useEffect, useState } from 'react'
import { Award, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  PageHeader, Modal, StatusPill, EmptyState, LoadingState, SearchInput, FilterTabs,
} from '@/components/admin/ui'

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

const CERT_TYPE_LABELS: Record<string, string> = {
  participation: 'Certificate of Participation',
  achievement: 'Certificate of Achievement',
  custom: 'Custom Certificate',
}

const EMPTY_FORM = {
  recipient_id: '',
  type: 'participation',
  title: '',
  description: '',
  send_email: true,
}

export default function AdminCertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([])
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showIssue, setShowIssue] = useState(false)
  const [search, setSearch] = useState('')
  const [sentFilter, setSentFilter] = useState<'all' | 'sent' | 'unsent'>('all')
  const [issueForm, setIssueForm] = useState(EMPTY_FORM)
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
        toast.success(issueForm.send_email ? 'Certificate issued and sent' : 'Certificate issued')
        setShowIssue(false)
        setIssueForm(EMPTY_FORM)
        load()
      } else toast.error('Failed to issue certificate')
    } catch { toast.error('Network error') }
    finally { setIssuing(false) }
  }

  const filtered = certs.filter(c => {
    if (sentFilter === 'sent' && !c.is_sent) return false
    if (sentFilter === 'unsent' && c.is_sent) return false
    if (!search) return true
    const q = search.toLowerCase()
    return c.title.toLowerCase().includes(q) || (c.recipient?.full_name || '').toLowerCase().includes(q)
  })
  const unsent = certs.filter(c => !c.is_sent).length

  const issueButton = (
    <button onClick={() => setShowIssue(true)} className="btn btn-primary gap-2 text-sm">
      <Plus className="w-4 h-4" /> Issue Certificate
    </button>
  )

  return (
    <div>
      <PageHeader
        icon={Award}
        eyebrow="Recognition"
        title="Certificates"
        description="Issued to participants and staff for achievements and completed programmes."
        meta={[`${filtered.length} issued`, unsent > 0 ? `${unsent} not yet sent` : null]}
        actions={issueButton}
      >
        <SearchInput value={search} onChange={setSearch} placeholder="Search title or recipient…" />
        <FilterTabs
          value={sentFilter}
          onChange={setSentFilter}
          options={[
            { value: 'all', label: 'All', count: certs.length },
            { value: 'unsent', label: 'Not sent', count: unsent },
            { value: 'sent', label: 'Sent', count: certs.length - unsent },
          ]}
        />
      </PageHeader>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Award}
          title={search || sentFilter !== 'all' ? 'No certificates match those filters' : 'No certificates issued yet'}
          description={search || sentFilter !== 'all' ? 'Clear the search or pick a different status.' : 'Issue one to a participant to get started.'}
          action={!search && sentFilter === 'all' && issueButton}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cert => (
            <div key={cert.id} className="card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Award className="w-5 h-5 flex-shrink-0 text-[var(--color-brand)]" />
                {cert.is_sent
                  ? <StatusPill tone="done" dot>Sent</StatusPill>
                  : <StatusPill tone="risk" dot>Not sent</StatusPill>}
              </div>
              <h3 className="font-display font-semibold text-[var(--color-text-primary)] leading-snug">{cert.title}</h3>
              <p className="font-mono text-[0.66rem] tracking-[0.1em] uppercase text-[var(--color-text-muted)] mt-1">
                {CERT_TYPE_LABELS[cert.type] || cert.type}
              </p>
              <dl className="text-xs text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border)] flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <dt>Recipient</dt>
                  <dd className="text-[var(--color-text-secondary)] font-medium truncate">{cert.recipient?.full_name || '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Issued</dt>
                  <dd className="text-[var(--color-text-secondary)]">{formatDate(cert.issued_date, 'long')}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showIssue}
        onClose={() => setShowIssue(false)}
        title="Issue Certificate"
        description="The recipient is emailed a copy only if you leave the box below ticked."
        footer={
          <>
            <button onClick={issueCertificate} disabled={issuing} className="btn btn-primary flex-1">
              {issuing ? 'Issuing…' : 'Issue Certificate'}
            </button>
            <button onClick={() => setShowIssue(false)} className="btn btn-ghost flex-1">Cancel</button>
          </>
        }
      >
        <div>
          <label className="label">Recipient *</label>
          <select className="input text-sm" value={issueForm.recipient_id} onChange={e => setIssueForm(f => ({ ...f, recipient_id: e.target.value }))}>
            <option value="">Select recipient…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.full_name} · {p.email}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Certificate Type</label>
          <select className="input text-sm" value={issueForm.type} onChange={e => setIssueForm(f => ({ ...f, type: e.target.value }))}>
            {Object.entries(CERT_TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Certificate Title *</label>
          <input className="input text-sm" value={issueForm.title} onChange={e => setIssueForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Certificate of Volunteer Excellence" />
        </div>
        <div>
          <label className="label">Achievement Description</label>
          <textarea rows={3} className="input text-sm" value={issueForm.description} onChange={e => setIssueForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Describe what was achieved…" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={issueForm.send_email} onChange={e => setIssueForm(f => ({ ...f, send_email: e.target.checked }))} className="w-4 h-4 accent-[var(--color-accent)]" />
          <span className="text-sm text-[var(--color-text-secondary)]">Email the certificate to the recipient</span>
        </label>
      </Modal>
    </div>
  )
}
