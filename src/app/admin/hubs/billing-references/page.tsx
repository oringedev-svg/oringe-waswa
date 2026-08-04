'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Plus, RefreshCw, Trash2, Edit2 } from 'lucide-react'
import SectionCard from '@/components/admin/SectionCard'
import { PageHeader, EmptyState, LoadingState, StatusPill } from '@/components/admin/ui'
import { formatCurrency } from '@/lib/utils'

interface BillingReference {
  id: string
  work_type: string
  billing_method: string
  default_value: number
  currency: string
  vat_profile: string
  estimated_hours?: number
  estimated_duration_label?: string
  notes?: string
  active: boolean
  created_at: string
}

const BILLING_METHODS = ['Fixed', 'Hourly', 'Unit', 'Percentage', 'Custom'] as const
const VAT_PROFILES = ['standard', 'exempt', 'reverse', 'zero'] as const

export default function BillingReferencesPage() {
  const [references, setReferences] = useState<BillingReference[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    work_type: '',
    billing_method: 'Fixed' as typeof BILLING_METHODS[number],
    default_value: 0,
    currency: 'KES',
    vat_profile: 'standard' as typeof VAT_PROFILES[number],
    estimated_hours: '',
    estimated_duration_label: '',
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing-references')
      if (!res.ok) {
        setError((await res.json()).error || 'Could not load billing references')
      } else {
        const { data } = await res.json()
        setReferences(data || [])
      }
    } catch {
      setError('Could not load billing references')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm({
      work_type: '',
      billing_method: 'Fixed',
      default_value: 0,
      currency: 'KES',
      vat_profile: 'standard',
      estimated_hours: '',
      estimated_duration_label: '',
      notes: '',
    })
    setEditing(null)
    setAdding(false)
  }

  const handleSave = async () => {
    if (!form.work_type.trim()) {
      setError('Work type is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        work_type: form.work_type.trim(),
        billing_method: form.billing_method,
        default_value: Number(form.default_value) || 0,
        currency: form.currency,
        vat_profile: form.vat_profile,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        estimated_duration_label: form.estimated_duration_label || null,
        notes: form.notes || null,
      }

      if (editing) {
        const res = await fetch(`/api/billing-references/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          setError((await res.json()).error || 'Could not update reference')
        } else {
          await load()
          resetForm()
        }
      } else {
        const res = await fetch('/api/billing-references', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Could not create reference')
        } else {
          await load()
          resetForm()
        }
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this billing reference? It will remain in audit history.')) return

    try {
      const res = await fetch(`/api/billing-references/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError((await res.json()).error || 'Could not deactivate reference')
      } else {
        await load()
      }
    } catch {
      setError('Could not deactivate reference')
    }
  }

  const handleEdit = (ref: BillingReference) => {
    setForm({
      work_type: ref.work_type,
      billing_method: ref.billing_method as typeof BILLING_METHODS[number],
      default_value: ref.default_value,
      currency: ref.currency,
      vat_profile: ref.vat_profile as typeof VAT_PROFILES[number],
      estimated_hours: ref.estimated_hours?.toString() || '',
      estimated_duration_label: ref.estimated_duration_label || '',
      notes: ref.notes || '',
    })
    setEditing(ref.id)
    setAdding(true)
  }

  return (
    <div>
      <PageHeader
        icon={DollarSign}
        eyebrow="Hubs · Reference data"
        title="Billing References"
        description="Define work types, pricing, and valuation for work planning and billing automation."
        meta={[`${references.length} work types configured`]}
        actions={
          <>
            <button className="btn btn-ghost gap-2" onClick={load}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button className="btn btn-primary gap-2" onClick={() => setAdding(!adding)}>
              <Plus className="w-4 h-4" /> {adding ? 'Cancel' : 'Add reference'}
            </button>
          </>
        }
      />

      {error && (
        <div className="card p-4 mb-5 bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
          <button
            className="text-xs text-red-600 hover:underline mt-2"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {adding && (
        <SectionCard
          title={editing ? 'Edit billing reference' : 'Add billing reference'}
          icon={Edit2}
          color="gold"
          defaultOpen={true}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              className="input"
              placeholder="Work type (e.g., 'Draft Agreement')"
              value={form.work_type}
              onChange={(e) => setForm({ ...form, work_type: e.target.value })}
            />
            <select
              className="input"
              value={form.billing_method}
              onChange={(e) =>
                setForm({ ...form, billing_method: e.target.value as typeof BILLING_METHODS[number] })
              }
            >
              {BILLING_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="input"
              placeholder="Default value"
              value={form.default_value}
              onChange={(e) => setForm({ ...form, default_value: Number(e.target.value) })}
            />
            <select
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>

            <input
              type="number"
              className="input"
              placeholder="Estimated hours (optional)"
              value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
            />
            <select
              className="input"
              value={form.vat_profile}
              onChange={(e) =>
                setForm({ ...form, vat_profile: e.target.value as typeof VAT_PROFILES[number] })
              }
            >
              {VAT_PROFILES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>

            <textarea
              className="input md:col-span-2"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2 mt-4 justify-end">
            <button className="btn btn-ghost" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !form.work_type.trim()}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <LoadingState label="Loading billing references" />
      ) : error && references.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No billing references"
          description="Create your first work type definition to get started."
          action={
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add reference
            </button>
          }
        />
      ) : references.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No billing references"
          description="No references configured yet."
          action={
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add reference
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="card p-4 flex items-start justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{ref.work_type}</h3>
                  <StatusPill tone={ref.active ? 'done' : 'risk'}>
                    {ref.active ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-2 space-y-1">
                  <div>
                    <span className="font-medium">{ref.billing_method}:</span>{' '}
                    {ref.currency} {Number(ref.default_value).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    {ref.billing_method === 'Hourly' ? '/hr' : ''}
                  </div>
                  {ref.estimated_hours && (
                    <div>
                      <span className="font-medium">Est. hours:</span> {ref.estimated_hours}h
                    </div>
                  )}
                  {ref.notes && <div>{ref.notes}</div>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="btn btn-ghost p-2"
                  title="Edit"
                  onClick={() => handleEdit(ref)}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  className="btn btn-ghost p-2 text-red-600 hover:bg-red-50"
                  title="Deactivate"
                  onClick={() => handleDelete(ref.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
