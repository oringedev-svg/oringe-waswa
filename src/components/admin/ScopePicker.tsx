'use client'
import { useEffect, useState } from 'react'

// A grant's scope narrows WHERE a permission applies (I1: every check
// resolves at a specific scope, never a bare "has permission"). 'office' is
// deliberately not offered here: this is a single-office firm, so an
// office-scoped grant is indistinguishable from a firm-wide one in
// practice, the schema supports it but the picker doesn't need to.
export const SCOPE_TYPES = ['firm', 'department', 'team', 'matter'] as const
export type ScopeType = (typeof SCOPE_TYPES)[number]

interface PracticeArea {
  id: string
  title: string
}

interface MatterOption {
  id: string
  matter_number: string
  title: string
}

interface ScopePickerProps {
  scopeType: string
  scopeId: string | null
  onScopeTypeChange: (scopeType: string) => void
  onScopeIdChange: (scopeId: string | null) => void
}

// 'department' and 'team' both resolve against practice_areas -- the only
// normalized grouping this firm's data actually has below firm-wide, reused
// rather than inventing separate department/team tables for a distinction
// the rest of the app doesn't draw either.
export default function ScopePicker({ scopeType, scopeId, onScopeTypeChange, onScopeIdChange }: ScopePickerProps) {
  const [practiceAreas, setPracticeAreas] = useState<PracticeArea[]>([])
  const [matterSearch, setMatterSearch] = useState('')
  const [matterResults, setMatterResults] = useState<MatterOption[]>([])
  const [selectedMatter, setSelectedMatter] = useState<MatterOption | null>(null)

  useEffect(() => {
    if (scopeType === 'department' || scopeType === 'team') {
      fetch('/api/practice-areas')
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setPracticeAreas(Array.isArray(d) ? d : d.data || []))
        .catch(() => setPracticeAreas([]))
    }
  }, [scopeType])

  useEffect(() => {
    if (scopeType !== 'matter' || matterSearch.trim().length < 2) {
      setMatterResults([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/files/matters?search=${encodeURIComponent(matterSearch.trim())}&limit=8`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((d) => setMatterResults(d.data || []))
        .catch(() => setMatterResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [scopeType, matterSearch])

  return (
    <div className="flex flex-col gap-2">
      <select
        className="input text-sm"
        value={scopeType}
        onChange={(e) => {
          onScopeTypeChange(e.target.value)
          onScopeIdChange(null)
          setSelectedMatter(null)
          setMatterSearch('')
        }}
      >
        <option value="firm">Firm-wide</option>
        <option value="department">Department</option>
        <option value="team">Team</option>
        <option value="matter">One matter</option>
      </select>

      {(scopeType === 'department' || scopeType === 'team') && (
        <select
          className="input text-sm"
          value={scopeId || ''}
          onChange={(e) => onScopeIdChange(e.target.value || null)}
        >
          <option value="">Select {scopeType}…</option>
          {practiceAreas.map((pa) => (
            <option key={pa.id} value={pa.id}>
              {pa.title}
            </option>
          ))}
        </select>
      )}

      {scopeType === 'matter' && (
        <div className="relative">
          <input
            type="text"
            className="input text-sm"
            placeholder="Search matter number or title…"
            value={selectedMatter ? `${selectedMatter.matter_number} · ${selectedMatter.title}` : matterSearch}
            onChange={(e) => {
              setSelectedMatter(null)
              onScopeIdChange(null)
              setMatterSearch(e.target.value)
            }}
          />
          {matterResults.length > 0 && !selectedMatter && (
            <div className="absolute z-10 mt-1 w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md shadow-[var(--shadow-md)] max-h-48 overflow-y-auto">
              {matterResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-surface-overlay)]"
                  onClick={() => {
                    setSelectedMatter(m)
                    onScopeIdChange(m.id)
                    setMatterResults([])
                  }}
                >
                  <span className="font-mono">{m.matter_number}</span> · {m.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
