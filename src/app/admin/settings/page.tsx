'use client'
import { useEffect, useState } from 'react'
import { Settings, Key, Save, Eye, EyeOff, Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { SETTINGS_SCHEMA, defaultSettingsMap, type SettingField, type NavMenuItem, type FooterLinkItem } from '@/lib/settingsSchema'

interface ApiKey { id: string; name: string; service: string; key_preview: string; is_active: boolean; created_at: string }

type SettingsState = Record<string, unknown>

function StringListField({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const list = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-2">
      {list.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input text-sm flex-1"
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="btn btn-ghost !p-2">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, ''])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  )
}

function LinksField({ value, onChange }: { value: { label: string; url: string }[]; onChange: (v: { label: string; url: string }[]) => void }) {
  const list = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-2">
      {list.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input className="input text-sm flex-1" placeholder="Label" value={item.label}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} />
          <input className="input text-sm flex-1" placeholder="/url or https://…" value={item.url}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, url: e.target.value } : v)))} />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="btn btn-ghost !p-2">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { label: '', url: '' }])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Link
      </button>
    </div>
  )
}

function StatsField({ value, onChange }: { value: { label: string; value: number; suffix: string }[]; onChange: (v: { label: string; value: number; suffix: string }[]) => void }) {
  const list = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-2">
      {list.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input className="input text-sm flex-1" placeholder="Label" value={item.label}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} />
          <input type="number" className="input text-sm w-24" placeholder="Value" value={item.value}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, value: Number(e.target.value) } : v)))} />
          <input className="input text-sm w-16" placeholder="+/%" value={item.suffix}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, suffix: e.target.value } : v)))} />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="btn btn-ghost !p-2">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { label: '', value: 0, suffix: '' }])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Stat
      </button>
    </div>
  )
}

function NavMenuField({ value, onChange }: { value: NavMenuItem[]; onChange: (v: NavMenuItem[]) => void }) {
  const list = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-2">
      {list.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className="input text-sm flex-1" placeholder="Label" value={item.label}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} />
          <input className="input text-sm flex-1" placeholder="/url or https://…" value={item.href}
            onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, href: e.target.value } : v)))} />
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] whitespace-nowrap cursor-pointer" title="Attach the live Practice Areas list as a dropdown under this item">
            <input type="checkbox" checked={!!item.hasSubmenu} onChange={(e) => onChange(list.map((v, j) => (j === i ? { ...v, hasSubmenu: e.target.checked } : v)))} />
            Submenu
          </label>
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="btn btn-ghost !p-2">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { label: '', href: '' }])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
        <Plus className="w-3.5 h-3.5" /> Add Menu Item
      </button>
      <p className="text-xs text-[var(--color-muted)]">"Submenu" attaches the live Practice Areas list (managed under Content → Practice Areas) as a dropdown, it always stays in sync automatically.</p>
    </div>
  )
}

function FooterColumnsField({ value, onChange }: { value: FooterLinkItem[][]; onChange: (v: FooterLinkItem[][]) => void }) {
  const columns = Array.isArray(value) ? value : []

  function updateColumn(colIndex: number, links: FooterLinkItem[]) {
    onChange(columns.map((c, i) => (i === colIndex ? links : c)))
  }

  return (
    <div className="flex flex-col gap-4">
      {columns.map((links, colIndex) => (
        <div key={colIndex} className="border border-[var(--color-border)] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Column {colIndex + 1}</span>
            <button onClick={() => onChange(columns.filter((_, i) => i !== colIndex))} className="btn btn-ghost !p-1.5">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {links.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input className="input text-sm flex-1" placeholder="Label" value={item.label}
                  onChange={(e) => updateColumn(colIndex, links.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))} />
                <input className="input text-sm flex-1" placeholder="/url or https://…" value={item.href}
                  onChange={(e) => updateColumn(colIndex, links.map((v, j) => (j === i ? { ...v, href: e.target.value } : v)))} />
                <button onClick={() => updateColumn(colIndex, links.filter((_, j) => j !== i))} className="btn btn-ghost !p-2">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ))}
            <button onClick={() => updateColumn(colIndex, [...links, { label: '', href: '' }])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Link
            </button>
          </div>
        </div>
      ))}
      {columns.length < 4 && (
        <button onClick={() => onChange([...columns, []])} className="btn btn-outline text-xs gap-1 self-start !py-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Column
        </button>
      )}
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: SettingField; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.type) {
    case 'textarea':
      return <textarea className="input text-sm" rows={3} value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} />
    case 'color':
      return (
        <div className="flex items-center gap-3">
          <input type="color" value={(value as string) || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded border border-[var(--color-border)] cursor-pointer" />
          <input className="input text-sm flex-1" value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    case 'select':
      return (
        <select className="input text-sm" value={(value as string) || ''} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'phones':
    case 'emails':
      return <StringListField value={value as string[]} onChange={onChange} placeholder={field.type === 'phones' ? '+254 7…' : 'name@firm.co.ke'} />
    case 'links':
      return <LinksField value={value as { label: string; url: string }[]} onChange={onChange} />
    case 'stats':
      return <StatsField value={value as { label: string; value: number; suffix: string }[]} onChange={onChange} />
    case 'nav-menu':
      return <NavMenuField value={value as NavMenuItem[]} onChange={onChange} />
    case 'footer-columns':
      return <FooterColumnsField value={value as FooterLinkItem[][]} onChange={onChange} />
    case 'image':
    case 'url':
    case 'text':
    default:
      return <input className="input text-sm" value={(value as string) || ''} onChange={(e) => onChange(e.target.value)} placeholder={field.type === 'image' || field.type === 'url' ? 'https://…' : undefined} />
  }
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettingsMap())
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<string>(SETTINGS_SCHEMA[0].id)
  const [newKey, setNewKey] = useState({ name: '', service: '', key: '' })
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()).catch(() => []),
      fetch('/api/settings/keys').then((r) => r.json()).catch(() => []),
    ]).then(([settingsData, keysData]) => {
      const s: SettingsState = { ...defaultSettingsMap() }
      ;(settingsData || []).forEach((item: { key: string; value: unknown }) => {
        s[item.key] = item.value
      })
      setSettings(s)
      setApiKeys(keysData || [])
    }).finally(() => setLoading(false))
  }, [])

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) toast.success('Settings saved!')
      else toast.error('Save failed')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const activeGroup = SETTINGS_SCHEMA.find((g) => g.id === tab)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">One place to control everything about the firm's site, nothing here is hardcoded.</p>
        </div>
        {tab !== 'apikeys' && (
          <button onClick={saveSettings} disabled={saving} className="btn btn-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--color-border)] mb-6 overflow-x-auto">
        {SETTINGS_SCHEMA.map((g) => (
          <button key={g.id} onClick={() => setTab(g.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === g.id ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'
            }`}>
            {g.label}
          </button>
        ))}
        <button onClick={() => setTab('apikeys')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            tab === 'apikeys' ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-transparent text-[var(--color-text-muted)]'
          }`}>
          API Keys
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" /></div>
      ) : tab !== 'apikeys' && activeGroup ? (
        <div className="max-w-2xl">
          <div className="card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="font-display font-semibold text-lg text-[var(--color-text-primary)]">{activeGroup.label}</h2>
            </div>
            <p className="text-sm text-[var(--color-muted)] -mt-3">{activeGroup.description}</p>

            {activeGroup.fields.map((field) => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                <FieldInput
                  field={field}
                  value={settings[field.key]}
                  onChange={(v) => setSettings((s) => ({ ...s, [field.key]: v }))}
                />
                {field.help && <p className="text-xs text-[var(--color-muted)] mt-1">{field.help}</p>}
              </div>
            ))}

            <button onClick={saveSettings} disabled={saving} className="btn btn-primary gap-2 self-start">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl">
          {/* Add new key */}
          <div className="card p-5 mb-6">
            <h3 className="font-display font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--color-accent)]" /> Add API Key
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Name</label>
                <input className="input text-sm" value={newKey.name} onChange={e => setNewKey(f => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenAI Production" />
              </div>
              <div>
                <label className="label">Service</label>
                <select className="input text-sm" value={newKey.service} onChange={e => setNewKey(f => ({ ...f, service: e.target.value }))}>
                  <option value="">Select…</option>
                  {['openai', 'google_maps', 'sendgrid', 'twilio', 'stripe', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">API Key</label>
                <div className="relative">
                  <input
                    type={showKey['new'] ? 'text' : 'password'}
                    className="input text-sm pr-9"
                    value={newKey.key}
                    onChange={e => setNewKey(f => ({ ...f, key: e.target.value }))}
                    placeholder="sk-…"
                  />
                  <button onClick={() => setShowKey(s => ({ ...s, new: !s.new }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                    {showKey['new'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <button onClick={async () => {
              if (!newKey.name || !newKey.service || !newKey.key) { toast.error('All fields required'); return }
              const res = await fetch('/api/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newKey),
              })
              if (res.ok) { toast.success('Key saved!'); setNewKey({ name: '', service: '', key: '' }); }
              else toast.error('Save failed')
            }} className="btn btn-primary text-sm gap-2">
              <Plus className="w-4 h-4" /> Save Key
            </button>
          </div>

          {/* Existing keys */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Stored API Keys</h3>
            </div>
            {apiKeys.length === 0 ? (
              <p className="text-[var(--color-muted)] text-sm p-4">No keys stored yet.</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {apiKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div>
                      <div className="font-medium text-sm text-[var(--color-text-primary)]">{key.name}</div>
                      <div className="text-xs text-[var(--color-muted)]">{key.service} · {key.key_preview}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${key.is_active ? 'status-active' : 'status-rejected'}`}>{key.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
