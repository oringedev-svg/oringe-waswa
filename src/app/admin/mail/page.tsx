'use client'
import { useEffect, useState } from 'react'
import { Mail, Plus, Send, Trash2, Loader2, Users, ChevronDown, Sparkles } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Subscriber { id: string; email: string; name?: string; is_active: boolean; tags: string[]; subscribed_at: string }
interface Campaign { id: string; subject: string; status: string; sent_count: number; sent_at?: string; created_at: string }

export default function AdminMailPage() {
  const [tab, setTab] = useState<'subscribers' | 'campaigns'>('subscribers')
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [showCompose, setShowCompose] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ subject: '', content: '', recipient_tags: '' })
  const [sending, setSending] = useState(false)
  const [aiDrafting, setAiDrafting] = useState(false)

  async function load() {
    setLoading(true)
    if (tab === 'subscribers') {
      const res = await fetch('/api/mail/subscribers?limit=100')
      const data = await res.json()
      setSubscribers(data.data || [])
      setTotal(data.count || 0)
    } else {
      const res = await fetch('/api/mail/campaigns')
      setCampaigns(await res.json() || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  async function removeSubscriber(id: string) {
    await fetch(`/api/mail/subscribers?id=${id}`, { method: 'DELETE' })
    toast.success('Removed')
    load()
  }

  async function saveCampaign(send = false) {
    if (!campaignForm.subject || !campaignForm.content) { toast.error('Subject and content required'); return }
    setSending(true)
    try {
      const res = await fetch('/api/mail/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: campaignForm.subject,
          content: campaignForm.content,
          recipient_tags: campaignForm.recipient_tags ? campaignForm.recipient_tags.split(',').map(t => t.trim()) : [],
          status: 'draft',
        }),
      })
      const data = await res.json()
      if (send) {
        await fetch('/api/mail/campaigns', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.id }),
        })
        toast.success('Campaign sent!')
      } else {
        toast.success('Campaign saved as draft!')
      }
      setShowCompose(false)
      setCampaignForm({ subject: '', content: '', recipient_tags: '' })
      if (tab === 'campaigns') load()
    } catch { toast.error('Failed') }
    finally { setSending(false) }
  }

  async function sendCampaign(id: string) {
    const res = await fetch('/api/mail/campaigns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    toast.success(`Sent to ${data.sent} subscribers!`)
    load()
  }

  async function aiDraftEmail() {
    if (!campaignForm.subject) { toast.error('Enter a subject first'); return }
    setAiDrafting(true)
    try {
      const res = await fetch('/api/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: campaignForm.subject,
          audience: campaignForm.recipient_tags || 'general subscribers',
        }),
      })
      const data = await res.json()
      setCampaignForm(f => ({ ...f, content: data.html || '' }))
      toast.success('Email drafted by AI!')
    } catch { toast.error('AI unavailable') }
    finally { setAiDrafting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Mailing List</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">{total} active subscribers</p>
        </div>
        <button onClick={() => setShowCompose(true)} className="btn btn-primary gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--color-border)] mb-6">
        {(['subscribers', 'campaigns'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : tab === 'subscribers' ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]" style={{ background: 'var(--color-surface-raised)' }}>
                {['Name / Email', 'Tags', 'Status', 'Subscribed', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {subscribers.map(sub => (
                <tr key={sub.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">{sub.name || '-'}</div>
                    <div className="text-xs text-[var(--color-muted)]">{sub.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {sub.tags?.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] border border-[var(--color-border)]">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${sub.is_active ? 'status-active' : 'status-rejected'}`}>{sub.is_active ? 'Active' : 'Unsubscribed'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{formatDate(sub.subscribed_at, 'short')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeSubscriber(sub.id)} className="btn btn-ghost p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {campaigns.length === 0 ? (
            <div className="card p-12 text-center text-[var(--color-muted)]">No campaigns yet.</div>
          ) : (
            campaigns.map(campaign => (
              <div key={campaign.id} className="card p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{campaign.subject}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-1">
                    {campaign.status === 'sent'
                      ? `Sent to ${campaign.sent_count} subscribers on ${formatDate(campaign.sent_at!, 'long')}`
                      : `Draft · Created ${formatDate(campaign.created_at, 'short')}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge text-xs ${campaign.status === 'sent' ? 'status-active' : 'status-pending'}`}>{campaign.status}</span>
                  {campaign.status === 'draft' && (
                    <button onClick={() => sendCampaign(campaign.id)} className="btn btn-primary text-xs gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 w-full max-w-2xl shadow-[var(--shadow-xl)] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <Mail className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-display font-semibold text-xl text-[var(--color-text-primary)]">Compose Campaign</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Subject *</label>
                <input className="input text-sm" value={campaignForm.subject} onChange={e => setCampaignForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject line" />
              </div>
              <div>
                <label className="label">Recipient Tags (leave empty for all)</label>
                <input className="input text-sm" value={campaignForm.recipient_tags} onChange={e => setCampaignForm(f => ({ ...f, recipient_tags: e.target.value }))} placeholder="e.g. clients, newsletter" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Email Content (HTML) *</label>
                  <button onClick={aiDraftEmail} disabled={aiDrafting} className="text-xs text-[var(--color-accent)] flex items-center gap-1 hover:underline">
                    {aiDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Draft
                  </button>
                </div>
                <textarea rows={12} className="input text-sm font-mono" value={campaignForm.content} onChange={e => setCampaignForm(f => ({ ...f, content: e.target.value }))} placeholder="<p>Dear Subscriber,</p>…" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => saveCampaign(false)} disabled={sending} className="btn btn-outline flex-1 text-sm">Save Draft</button>
                <button onClick={() => saveCampaign(true)} disabled={sending} className="btn btn-primary flex-1 text-sm gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
