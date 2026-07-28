'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Network, Scale, Briefcase, FileText, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface OrgCategory { id: string; name: string; description: string | null; sort_order: number }
interface ProfessionalType { id: string; org_category_id: string | null; name: string; sort_order: number; category?: { id: string; name: string } | null }
interface Position {
  id: string; name: string; hierarchy_level: number; reports_to_position_id: string | null
  can_supervise: boolean; approval_level: number; can_sign_documents: boolean; can_approve_bills: boolean; can_assign_matters: boolean
  maps_to_role: string | null; sort_order: number
  reports_to?: { id: string; name: string } | null
  eligible?: { professional_type: { id: string; name: string } }[]
}
interface LegalAuthority { id: string; name: string; description: string | null; sort_order: number }
interface Industry { id: string; name: string; sort_order: number }
interface Skill { id: string; name: string; sort_order: number }
interface DocumentType { id: string; name: string; description: string | null; sort_order: number; required_for?: { is_required: boolean; professional_type: { id: string; name: string } }[] }

const ROLES = ['admin', 'staff', 'moderator', 'client', 'volunteer', 'public', 'pupil', 'admin_assistant']
const TABS = [
  { key: 'structure', label: 'Structure', icon: Network },
  { key: 'authorities', label: 'Legal Authorities', icon: Scale },
  { key: 'skills', label: 'Industries & Skills', icon: Briefcase },
  { key: 'documents', label: 'Document Requirements', icon: FileText },
] as const

export default function AdminOrganizationPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('structure')

  const [categories, setCategories] = useState<OrgCategory[]>([])
  const [types, setTypes] = useState<ProfessionalType[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [authorities, setAuthorities] = useState<LegalAuthority[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [docTypes, setDocTypes] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPosition, setExpandedPosition] = useState<Record<string, boolean>>({})
  const [expandedDocType, setExpandedDocType] = useState<Record<string, boolean>>({})

  const [editingCategory, setEditingCategory] = useState<Partial<OrgCategory> | null>(null)
  const [editingType, setEditingType] = useState<Partial<ProfessionalType> | null>(null)
  const [editingPosition, setEditingPosition] = useState<(Partial<Position> & { eligible_professional_type_ids?: string[] }) | null>(null)
  const [editingAuthority, setEditingAuthority] = useState<Partial<LegalAuthority> | null>(null)
  const [editingIndustry, setEditingIndustry] = useState<Partial<Industry> | null>(null)
  const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null)
  const [editingDocType, setEditingDocType] = useState<(Partial<DocumentType> & { required_for_professional_type_ids?: string[] }) | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  function loadAll() {
    setLoading(true)
    Promise.all([
      fetch('/api/organization/categories').then(r => r.json()).catch(() => []),
      fetch('/api/organization/professional-types').then(r => r.json()).catch(() => []),
      fetch('/api/organization/positions').then(r => r.json()).catch(() => []),
      fetch('/api/organization/authorities').then(r => r.json()).catch(() => []),
      fetch('/api/organization/industries').then(r => r.json()).catch(() => []),
      fetch('/api/organization/skills').then(r => r.json()).catch(() => []),
      fetch('/api/organization/document-types').then(r => r.json()).catch(() => []),
    ]).then(([c, t, p, a, i, s, d]) => {
      setCategories(Array.isArray(c) ? c : [])
      setTypes(Array.isArray(t) ? t : [])
      setPositions(Array.isArray(p) ? p : [])
      setAuthorities(Array.isArray(a) ? a : [])
      setIndustries(Array.isArray(i) ? i : [])
      setSkills(Array.isArray(s) ? s : [])
      setDocTypes(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  async function saveSimple(
    editing: { id?: string } | null,
    endpoint: string,
    isNewRecord: boolean,
    onDone: () => void
  ) {
    if (!editing) return
    setSaving(true)
    try {
      const res = isNewRecord
        ? await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
        : await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      if (res.ok) { toast.success(isNewRecord ? 'Added' : 'Saved'); onDone(); loadAll() }
      else toast.error((await res.json().catch(() => ({}))).error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function archiveItem(endpoint: string, id: string) {
    if (!confirm('Archive this item? It stays available for historical records but disappears from new selections.')) return
    const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Archived'); loadAll() }
    else toast.error('Could not archive')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Organization</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Structure, positions, legal authorities, and document requirements, seeded but fully firm-editable.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`btn gap-2 text-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : (
        <>
          {tab === 'structure' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Organizational Categories</h2>
                  <button onClick={() => { setEditingCategory({ sort_order: categories.length }); setIsNew(true) }} className="btn btn-outline gap-2 text-sm"><Plus className="w-4 h-4" /> Add</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map(c => (
                    <div key={c.id} className="card p-3 flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--color-text-primary)]">{c.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingCategory(c); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => archiveItem('/api/organization/categories', c.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Professional Types</h2>
                  <button onClick={() => { setEditingType({ sort_order: types.length }); setIsNew(true) }} className="btn btn-outline gap-2 text-sm"><Plus className="w-4 h-4" /> Add</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {types.map(t => (
                    <div key={t.id} className="card p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm text-[var(--color-text-primary)]">{t.name}</div>
                        <div className="text-xs text-[var(--color-muted)]">{t.category?.name || 'Uncategorized'}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditingType(t); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => archiveItem('/api/organization/professional-types', t.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Positions</h2>
                  <button onClick={() => { setEditingPosition({ sort_order: positions.length, hierarchy_level: 0, approval_level: 0, eligible_professional_type_ids: [] }); setIsNew(true) }} className="btn btn-outline gap-2 text-sm"><Plus className="w-4 h-4" /> Add</button>
                </div>
                <div className="flex flex-col gap-2">
                  {positions.map(p => {
                    const isOpen = expandedPosition[p.id] ?? false
                    return (
                      <div key={p.id} className="card overflow-hidden">
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button onClick={() => setExpandedPosition(e => ({ ...e, [p.id]: !isOpen }))} className="flex-1 flex items-center gap-2 text-left min-w-0">
                            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</span>
                            <span className="text-xs text-[var(--color-muted)]">Level {p.hierarchy_level}{p.reports_to ? ` · reports to ${p.reports_to.name}` : ''}</span>
                            {p.maps_to_role && <span className="badge status-review text-xs">{p.maps_to_role}</span>}
                          </button>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingPosition({ ...p, eligible_professional_type_ids: (p.eligible || []).map(e => e.professional_type.id) }); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => archiveItem('/api/organization/positions', p.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="px-3 pb-3 text-xs text-[var(--color-text-secondary)] flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1.5">
                              {p.can_supervise && <span className="badge status-active text-xs">Supervises</span>}
                              {p.can_sign_documents && <span className="badge status-active text-xs">Signs Documents</span>}
                              {p.can_approve_bills && <span className="badge status-active text-xs">Approves Bills</span>}
                              {p.can_assign_matters && <span className="badge status-active text-xs">Assigns Matters</span>}
                              <span className="badge status-review text-xs">Approval level {p.approval_level}</span>
                            </div>
                            <div className="mt-1">
                              <span className="text-[var(--color-muted)]">Eligible professional types: </span>
                              {(p.eligible || []).map(e => e.professional_type.name).join(', ') || 'None set'}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'authorities' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingAuthority({ sort_order: authorities.length }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm"><Plus className="w-4 h-4" /> Add Authority</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {authorities.map(a => (
                  <div key={a.id} className="card p-3 flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--color-text-primary)]">{a.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingAuthority(a); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archiveItem('/api/organization/authorities', a.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'skills' && (
            <div className="flex flex-col gap-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Industries</h2>
                  <button onClick={() => { setEditingIndustry({ sort_order: industries.length }); setIsNew(true) }} className="btn btn-outline gap-2 text-sm"><Plus className="w-4 h-4" /> Add</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {industries.map(i => (
                    <div key={i.id} className="card p-3 flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--color-text-primary)]">{i.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingIndustry(i); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => archiveItem('/api/organization/industries', i.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">Skills</h2>
                  <button onClick={() => { setEditingSkill({ sort_order: skills.length }); setIsNew(true) }} className="btn btn-outline gap-2 text-sm"><Plus className="w-4 h-4" /> Add</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {skills.map(s => (
                    <div key={s.id} className="card p-3 flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--color-text-primary)]">{s.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingSkill(s); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => archiveItem('/api/organization/skills', s.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={() => { setEditingDocType({ sort_order: docTypes.length, required_for_professional_type_ids: [] }); setIsNew(true) }} className="btn btn-primary gap-2 text-sm"><Plus className="w-4 h-4" /> Add Document Type</button>
              </div>
              <div className="flex flex-col gap-2">
                {docTypes.map(d => {
                  const isOpen = expandedDocType[d.id] ?? false
                  return (
                    <div key={d.id} className="card overflow-hidden">
                      <div className="flex items-center justify-between gap-2 p-3">
                        <button onClick={() => setExpandedDocType(e => ({ ...e, [d.id]: !isOpen }))} className="flex-1 flex items-center gap-2 text-left min-w-0">
                          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-[var(--color-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{d.name}</span>
                          <span className="text-xs text-[var(--color-muted)]">{(d.required_for || []).length} professional type{(d.required_for || []).length === 1 ? '' : 's'}</span>
                        </button>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditingDocType({ ...d, required_for_professional_type_ids: (d.required_for || []).map(r => r.professional_type.id) }); setIsNew(false) }} className="btn btn-ghost p-1 !px-1"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => archiveItem('/api/organization/document-types', d.id)} className="btn btn-ghost p-1 !px-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="px-3 pb-3 text-xs text-[var(--color-text-secondary)]">
                          Required for: {(d.required_for || []).map(r => r.professional_type.name).join(', ') || 'Nobody yet'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Simple name/description modals */}
      {editingCategory && (
        <SimpleModal title={isNew ? 'Add Category' : 'Edit Category'} saving={saving} onCancel={() => setEditingCategory(null)}
          onSave={() => saveSimple(editingCategory, '/api/organization/categories', isNew, () => setEditingCategory(null))}>
          <input className="input text-sm" placeholder="Name" value={editingCategory.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} />
          <textarea className="input text-sm" rows={2} placeholder="Description (optional)" value={editingCategory.description || ''} onChange={e => setEditingCategory({ ...editingCategory, description: e.target.value })} />
        </SimpleModal>
      )}

      {editingType && (
        <SimpleModal title={isNew ? 'Add Professional Type' : 'Edit Professional Type'} saving={saving} onCancel={() => setEditingType(null)}
          onSave={() => saveSimple(editingType, '/api/organization/professional-types', isNew, () => setEditingType(null))}>
          <input className="input text-sm" placeholder="Name" value={editingType.name || ''} onChange={e => setEditingType({ ...editingType, name: e.target.value })} />
          <select className="input text-sm" value={editingType.org_category_id || ''} onChange={e => setEditingType({ ...editingType, org_category_id: e.target.value })}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </SimpleModal>
      )}

      {editingAuthority && (
        <SimpleModal title={isNew ? 'Add Legal Authority' : 'Edit Legal Authority'} saving={saving} onCancel={() => setEditingAuthority(null)}
          onSave={() => saveSimple(editingAuthority, '/api/organization/authorities', isNew, () => setEditingAuthority(null))}>
          <input className="input text-sm" placeholder="Name" value={editingAuthority.name || ''} onChange={e => setEditingAuthority({ ...editingAuthority, name: e.target.value })} />
          <textarea className="input text-sm" rows={2} placeholder="Description (optional)" value={editingAuthority.description || ''} onChange={e => setEditingAuthority({ ...editingAuthority, description: e.target.value })} />
        </SimpleModal>
      )}

      {editingIndustry && (
        <SimpleModal title={isNew ? 'Add Industry' : 'Edit Industry'} saving={saving} onCancel={() => setEditingIndustry(null)}
          onSave={() => saveSimple(editingIndustry, '/api/organization/industries', isNew, () => setEditingIndustry(null))}>
          <input className="input text-sm" placeholder="Name" value={editingIndustry.name || ''} onChange={e => setEditingIndustry({ ...editingIndustry, name: e.target.value })} />
        </SimpleModal>
      )}

      {editingSkill && (
        <SimpleModal title={isNew ? 'Add Skill' : 'Edit Skill'} saving={saving} onCancel={() => setEditingSkill(null)}
          onSave={() => saveSimple(editingSkill, '/api/organization/skills', isNew, () => setEditingSkill(null))}>
          <input className="input text-sm" placeholder="Name" value={editingSkill.name || ''} onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value })} />
        </SimpleModal>
      )}

      {editingDocType && (
        <SimpleModal title={isNew ? 'Add Document Type' : 'Edit Document Type'} saving={saving} onCancel={() => setEditingDocType(null)}
          onSave={() => saveSimple(editingDocType, '/api/organization/document-types', isNew, () => setEditingDocType(null))}>
          <input className="input text-sm" placeholder="Name" value={editingDocType.name || ''} onChange={e => setEditingDocType({ ...editingDocType, name: e.target.value })} />
          <div>
            <label className="label">Required for</label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-md p-2">
              {types.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox"
                    checked={(editingDocType.required_for_professional_type_ids || []).includes(t.id)}
                    onChange={e => {
                      const current = editingDocType.required_for_professional_type_ids || []
                      setEditingDocType({ ...editingDocType, required_for_professional_type_ids: e.target.checked ? [...current, t.id] : current.filter(id => id !== t.id) })
                    }} />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
        </SimpleModal>
      )}

      {editingPosition && (
        <SimpleModal title={isNew ? 'Add Position' : 'Edit Position'} saving={saving} wide onCancel={() => setEditingPosition(null)}
          onSave={() => saveSimple(editingPosition, '/api/organization/positions', isNew, () => setEditingPosition(null))}>
          <input className="input text-sm" placeholder="Name" value={editingPosition.name || ''} onChange={e => setEditingPosition({ ...editingPosition, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Hierarchy Level</label>
              <input type="number" className="input text-sm" value={editingPosition.hierarchy_level ?? 0} onChange={e => setEditingPosition({ ...editingPosition, hierarchy_level: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Approval Level</label>
              <input type="number" className="input text-sm" value={editingPosition.approval_level ?? 0} onChange={e => setEditingPosition({ ...editingPosition, approval_level: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Reports To</label>
            <select className="input text-sm" value={editingPosition.reports_to_position_id || ''} onChange={e => setEditingPosition({ ...editingPosition, reports_to_position_id: e.target.value || null })}>
              <option value="">Nobody</option>
              {positions.filter(p => p.id !== editingPosition.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Maps to Account Role</label>
            <select className="input text-sm" value={editingPosition.maps_to_role || ''} onChange={e => setEditingPosition({ ...editingPosition, maps_to_role: e.target.value || null })}>
              <option value="">Not set (falls back to seniority)</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            {([
              ['can_supervise', 'Can Supervise'],
              ['can_sign_documents', 'Can Sign Documents'],
              ['can_approve_bills', 'Can Approve Bills'],
              ['can_assign_matters', 'Can Assign Matters'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={!!editingPosition[key]} onChange={e => setEditingPosition({ ...editingPosition, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <div>
            <label className="label">Eligible Professional Types</label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-[var(--color-border)] rounded-md p-2">
              {types.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox"
                    checked={(editingPosition.eligible_professional_type_ids || []).includes(t.id)}
                    onChange={e => {
                      const current = editingPosition.eligible_professional_type_ids || []
                      setEditingPosition({ ...editingPosition, eligible_professional_type_ids: e.target.checked ? [...current, t.id] : current.filter(id => id !== t.id) })
                    }} />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  )
}

function SimpleModal({ title, children, onSave, onCancel, saving, wide }: {
  title: string
  children: React.ReactNode
  onSave: () => void
  onCancel: () => void
  saving: boolean
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className={`bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-full ${wide ? 'max-w-lg' : 'max-w-sm'} p-6 max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{title}</h2>
          <button onClick={onCancel} className="btn btn-ghost p-2 !px-2"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
        <div className="flex gap-3 mt-6">
          <button onClick={onSave} disabled={saving} className="btn btn-primary flex-1 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
          </button>
          <button onClick={onCancel} className="btn btn-ghost flex-1">Cancel</button>
        </div>
      </div>
    </div>
  )
}
