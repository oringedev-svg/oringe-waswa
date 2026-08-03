'use client'

import { useEffect, useState } from 'react'
import { FilePlus2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  name: string
  category: string
  artifact_type_name: string | null
  guidance: string | null
}

interface Props {
  matterId: string
  matterType: string
  onCreated: () => void
}

// Starts a matter-owned editable copy. It never edits or exposes the master
// drafting-library file as the live client document.
export default function DocumentTemplateLauncher({ matterId, matterType, onCreated }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let current = true
    fetch(`/api/document-templates?practice_area=${encodeURIComponent(matterType)}`)
      .then(async res => res.ok ? res.json() : { templates: [] })
      .then(data => { if (current) setTemplates(data.templates || []) })
      .catch(() => { if (current) setTemplates([]) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [matterType])

  async function createWorkingCopy() {
    if (!selectedId) { toast.error('Choose a drafting template first'); return }
    setCreating(true)
    try {
      const res = await fetch(`/api/document-templates/${selectedId}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_id: matterId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not create the working copy')
        return
      }
      toast.success('Working copy created. Complete and review it before use.')
      setSelectedId('')
      onCreated()
    } finally { setCreating(false) }
  }

  if (!loading && templates.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        className="input text-sm min-w-52"
        aria-label="Drafting template"
        disabled={loading || creating}
        value={selectedId}
        onChange={event => setSelectedId(event.target.value)}
      >
        <option value="">{loading ? 'Loading templates…' : 'Start from a template…'}</option>
        {templates.map(template => (
          <option key={template.id} value={template.id}>{template.category}: {template.name}</option>
        ))}
      </select>
      <button onClick={createWorkingCopy} disabled={!selectedId || creating} className="btn btn-outline gap-2 text-sm">
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
        Use Template
      </button>
    </div>
  )
}
