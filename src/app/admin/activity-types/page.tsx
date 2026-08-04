'use client'

import { useEffect, useState } from 'react'
import { Zap, Plus, RefreshCw, Trash2, Edit2 } from 'lucide-react'
import SectionCard from '@/components/admin/SectionCard'
import { PageHeader, EmptyState, LoadingState, StatusPill } from '@/components/admin/ui'

interface BillingReference {
  id: string
  work_type: string
  billing_method: string
  default_value: number
}

interface ActivityType {
  id: string
  activity_key: string
  name: string
  category: string
  description?: string
  default_due_days?: number
  is_active: boolean
  billing_reference?: BillingReference | null
  created_at: string
}

const CATEGORIES = ['legal_work', 'intake', 'administrative', 'research', 'negotiation'] as const

export default function ActivityTypesPage() {
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [billingRefs, setBillingRefs] = useState<BillingReference[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    activity_key: '',
    name: '',
    category: 'legal_work' as typeof CATEGORIES[number],
    description: '',
    default_due_days: '',
    billing_reference_id: '',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [activitiesRes, billingRes] = await Promise.all([
        fetch('/api/activity-types'),
        fetch('/api/billing-references'),
      ])

      if (!activitiesRes.ok) {
        setError((await activitiesRes.json()).error || 'Could not load activities')
      } else {
        const { data } = await activitiesRes.json()
        setActivities(data || [])
      }

      if (!billingRes.ok) {
        setError((await billingRes.json()).error || 'Could not load billing references')
      } else {
        const { data } = await billingRes.json()
        setBillingRefs((data || []).filter((r: BillingReference) => r))
      }
    } catch {
      setError('Could not load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm({
      activity_key: '',
      name: '',
      category: 'legal_work',
      description: '',
      default_due_days: '',
      billing_reference_id: '',
    })
    setEditing(null)
    setAdding(false)
  }

  const handleSave = async () => {
    if (!form.activity_key.trim() || !form.name.trim()) {
      setError('Activity key and name are required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        activity_key: form.activity_key.trim(),
        name: form.name.trim(),
        category: form.category,
        description: form.description || null,
        default_due_days: form.default_due_days ? Number(form.default_due_days) : null,
        billing_reference_id: form.billing_reference_id || null,
      }

      if (editing) {
        const res = await fetch(`/api/activity-types/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          setError((await res.json()).error || 'Could not update activity')
        } else {
          await load()
          resetForm()
        }
      } else {
        const res = await fetch('/api/activity-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Could not create activity')
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
    if (!confirm('Deactivate this activity type? It will remain in audit history.')) return

    try {
      const res = await fetch(`/api/activity-types/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError((await res.json()).error || 'Could not deactivate activity')
      } else {
        await load()
      }
    } catch {
      setError('Could not deactivate activity')
    }
  }

  const handleEdit = (activity: ActivityType) => {
    setForm({
      activity_key: activity.activity_key,
      name: activity.name,
      category: activity.category as typeof CATEGORIES[number],
      description: activity.description || '',
      default_due_days: activity.default_due_days?.toString() || '',
      billing_reference_id: activity.billing_reference?.id || '',
    })
    setEditing(activity.id)
    setAdding(true)
  }

  const getBillingRefDisplay = (ref?: BillingReference | null) => {
    if (!ref) return 'No billing reference'
    return `${ref.work_type} (${ref.billing_method})`
  }

  return (
    <div>
      <PageHeader
        icon={Zap}
        eyebrow="Operations"
        title="Activity Types"
        description="Define workflow activities that can be assigned. Wire each to a Billing Reference to auto-populate estimated value."
        meta={[`${activities.length} activity types configured`]}
        actions={
          <>
            <button className="btn btn-ghost gap-2" onClick={load}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button className="btn btn-primary gap-2" onClick={() => setAdding(!adding)}>
              <Plus className="w-4 h-4" /> {adding ? 'Cancel' : 'Add activity'}
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
          title={editing ? 'Edit activity type' : 'Add activity type'}
          icon={Edit2}
          color="purple"
          defaultOpen={true}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="text"
              className="input"
              placeholder="Activity key (e.g., DRAFT_AGREEMENT)"
              value={form.activity_key}
              onChange={(e) => setForm({ ...form, activity_key: e.target.value })}
            />
            <input
              type="text"
              className="input"
              placeholder="Activity name (e.g., 'Draft Agreement')"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <select
              className="input"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as typeof CATEGORIES[number] })
              }
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="input"
              placeholder="Default due days (optional)"
              value={form.default_due_days}
              onChange={(e) => setForm({ ...form, default_due_days: e.target.value })}
            />

            <select
              className="input md:col-span-2"
              value={form.billing_reference_id}
              onChange={(e) => setForm({ ...form, billing_reference_id: e.target.value })}
            >
              <option value="">No billing reference</option>
              {billingRefs.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.work_type} ({ref.billing_method}) — {ref.default_value}
                </option>
              ))}
            </select>

            <textarea
              className="input md:col-span-2"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex gap-2 mt-4 justify-end">
            <button className="btn btn-ghost" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={saving || !form.activity_key.trim() || !form.name.trim()}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <LoadingState label="Loading activity types" />
      ) : activities.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No activity types"
          description="Create your first activity type to get started."
          action={
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add activity
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="card p-4 flex items-start justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{activity.name}</h3>
                  <StatusPill tone={activity.is_active ? 'done' : 'risk'}>
                    {activity.is_active ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-2 space-y-1">
                  <div>
                    <span className="font-medium">Key:</span> {activity.activity_key}
                  </div>
                  <div>
                    <span className="font-medium">Category:</span> {activity.category}
                  </div>
                  {activity.default_due_days && (
                    <div>
                      <span className="font-medium">Default due:</span> {activity.default_due_days}d
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Billing:</span> {getBillingRefDisplay(activity.billing_reference)}
                  </div>
                  {activity.description && <div>{activity.description}</div>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="btn btn-ghost p-2"
                  title="Edit"
                  onClick={() => handleEdit(activity)}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  className="btn btn-ghost p-2 text-red-600 hover:bg-red-50"
                  title="Deactivate"
                  onClick={() => handleDelete(activity.id)}
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
