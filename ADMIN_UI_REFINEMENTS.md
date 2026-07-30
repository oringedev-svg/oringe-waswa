# Admin UI Refinements: Enhanced Intelligence Display

**Strategy**: Keep existing design language (Fraunces + Inter, gray + brass), enhance admin pages to display engine results (conflicts, risks, deadlines) with better visual hierarchy.

---

## 1. New Shared Admin Components

### IntelligenceAlert.tsx
Reusable component for showing engine results (conflicts, risks, deadlines)

```tsx
'use client'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react'

interface IntelligenceAlertProps {
  type: 'conflict' | 'risk' | 'deadline' | 'info'
  title: string
  description: string
  details?: string
  confidence?: number
  severity?: 'low' | 'medium' | 'high' | 'critical'
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'danger'
  }>
  onDismiss?: () => void
}

export default function IntelligenceAlert({
  type,
  title,
  description,
  details,
  confidence,
  actions,
  onDismiss,
}: IntelligenceAlertProps) {
  const getStyles = () => {
    switch (type) {
      case 'conflict':
        return {
          bg: 'bg-[#fff5f5]',
          border: 'border-[#ff6b6b]',
          icon: <AlertCircle className="w-5 h-5 text-[#c92a2a]" />,
          label: 'CONFLICT DETECTED',
          labelColor: 'text-[#9b2335]',
        }
      case 'risk':
        return {
          bg: 'bg-[#fff8e6]',
          border: 'border-[#ffa94d]',
          icon: <AlertTriangle className="w-5 h-5 text-[#e67700]" />,
          label: 'RISK ASSESSMENT',
          labelColor: 'text-[#f59f00]',
        }
      case 'deadline':
        return {
          bg: 'bg-[#e7ece6]',
          border: 'border-[#a97d2f]',
          icon: <AlertCircle className="w-5 h-5 text-[#8a6524]" />,
          label: 'DEADLINE',
          labelColor: 'text-[#a97d2f]',
        }
      default:
        return {
          bg: 'bg-[#e4ebee]',
          border: 'border-[#2f6e78]',
          icon: <CheckCircle2 className="w-5 h-5 text-[#2f6e78]" />,
          label: 'INFO',
          labelColor: 'text-[#2f6e78]',
        }
    }
  }

  const styles = getStyles()

  return (
    <div className={cn(
      'border-l-4 p-4 rounded-lg mb-4',
      styles.bg,
      styles.border,
      'dark:bg-opacity-10 dark:border-opacity-30'
    )}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>

        <div className="flex-1">
          <div className={cn('text-xs font-semibold tracking-wider mb-1', styles.labelColor)}>
            {styles.label}
          </div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {title}
          </h4>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            {description}
          </p>

          {details && (
            <p className="text-xs text-[var(--color-text-muted)] bg-white/50 p-2 rounded mb-3">
              {details}
            </p>
          )}

          {confidence && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">Confidence</span>
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">{confidence}%</span>
              </div>
              <div className="w-full bg-white/50 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all',
                    type === 'conflict' ? 'bg-[#ff6b6b]' :
                    type === 'risk' ? 'bg-[#ffa94d]' :
                    'bg-[#a97d2f]'
                  )}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}

          {actions && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded transition-colors',
                    action.variant === 'danger'
                      ? 'bg-[#ff6b6b] text-white hover:bg-[#c92a2a]'
                      : action.variant === 'secondary'
                      ? 'bg-white/50 text-[var(--color-text-primary)] hover:bg-white border border-white/30'
                      : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)]'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## 2. New Admin Dashboard Section

Add this to `/admin/page.tsx` (after existing stats):

```tsx
// After the existing Desk content, add:

<section className="mt-12">
  <h2 className="text-display text-2xl font-semibold text-[var(--color-text-primary)] mb-6">
    Intelligence & Actions
  </h2>

  {/* Conflicts Section */}
  {conflicts.length > 0 && (
    <div className="mb-8">
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-3 text-lg">
        🚨 Conflicts Requiring Review ({conflicts.length})
      </h3>
      <div className="space-y-3">
        {conflicts.map(conflict => (
          <IntelligenceAlert
            key={conflict.id}
            type="conflict"
            title={`${conflict.description}`}
            description={`Found in related case: ${conflict.relatedCaseNumber}`}
            confidence={conflict.confidence}
            actions={[
              {
                label: 'Review Conflict',
                onClick: () => router.push(`/admin/matters/${conflict.matterId}?tab=conflicts`),
              },
              {
                label: 'Dismiss',
                onClick: () => dismissConflict(conflict.id),
                variant: 'secondary',
              },
            ]}
          />
        ))}
      </div>
    </div>
  )}

  {/* Risk Assessments Section */}
  {risks.length > 0 && (
    <div className="mb-8">
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-3 text-lg">
        ⚖️ High-Risk Matters ({risks.length})
      </h3>
      <div className="space-y-3">
        {risks.map(risk => (
          <IntelligenceAlert
            key={risk.id}
            type="risk"
            title={`${risk.matterTitle} - Score: ${risk.riskScore}/100`}
            description={`${risk.topFactors[0]}`}
            details={`Top factors: ${risk.topFactors.join(', ')}`}
            confidence={risk.confidence}
            actions={[
              {
                label: 'Review Risk',
                onClick: () => router.push(`/admin/matters/${risk.matterId}?tab=risk`),
              },
              {
                label: 'Acknowledge',
                onClick: () => acknowledgeRisk(risk.id),
                variant: 'secondary',
              },
            ]}
          />
        ))}
      </div>
    </div>
  )}

  {/* Upcoming Deadlines Section */}
  {deadlines.length > 0 && (
    <div>
      <h3 className="font-semibold text-[var(--color-text-primary)] mb-3 text-lg">
        📅 Deadlines Pending Confirmation ({deadlines.length})
      </h3>
      <div className="space-y-3">
        {deadlines.map(deadline => (
          <IntelligenceAlert
            key={deadline.id}
            type="deadline"
            title={`${deadline.description}`}
            description={`Due: ${new Date(deadline.dueDate).toLocaleDateString()}`}
            details={`For matter: ${deadline.matterTitle}`}
            actions={[
              {
                label: 'Confirm',
                onClick: () => confirmDeadline(deadline.id),
              },
              {
                label: 'Review',
                onClick: () => router.push(`/admin/matters/${deadline.matterId}?tab=deadlines`),
                variant: 'secondary',
              },
            ]}
          />
        ))}
      </div>
    </div>
  )}
</section>
```

---

## 3. Enhanced Matter File Page

Update `/admin/matters/[id]/page.tsx` to show engine results:

### Tab Navigation
```tsx
<div className="border-b border-[var(--color-border)] mb-6">
  <div className="flex gap-1 overflow-x-auto">
    {[
      { id: 'overview', label: 'Overview', icon: '📋' },
      { id: 'calendar', label: 'Calendar', icon: '📅', badge: upcomingEvents.length },
      { id: 'conflicts', label: 'Conflicts', icon: '🚨', badge: conflicts.length },
      { id: 'risks', label: 'Risks', icon: '⚖️', badge: risks.length },
      { id: 'deadlines', label: 'Deadlines', icon: '📅', badge: deadlines.length },
      { id: 'documents', label: 'Documents', icon: '📄', badge: documents.length },
      { id: 'people', label: 'People', icon: '👥' },
    ].map(tab => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          'px-4 py-3 text-sm font-medium whitespace-nowrap relative transition-colors',
          activeTab === tab.id
            ? 'text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        )}
      >
        <span>{tab.icon} {tab.label}</span>
        {tab.badge && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-[#ff6b6b] text-white rounded-full">
            {tab.badge}
          </span>
        )}
      </button>
    ))}
  </div>
</div>
```

### Conflicts Tab
```tsx
{activeTab === 'conflicts' && (
  <div>
    {conflicts.length === 0 ? (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p>✓ No conflicts detected</p>
      </div>
    ) : (
      <div className="space-y-4">
        {conflicts.map(conflict => (
          <IntelligenceAlert
            key={conflict.id}
            type="conflict"
            title={conflict.description}
            description={`Related to: ${conflict.relatedCaseName}`}
            details={`Found ${conflict.commonElements.length} common elements`}
            confidence={conflict.confidence}
            actions={[
              { label: 'Acknowledge', onClick: () => acknowledgeConflict(conflict.id) },
              { label: 'Escalate to Ethics', onClick: () => escalateConflict(conflict.id), variant: 'secondary' },
              { label: 'Not a Conflict', onClick: () => dismissConflict(conflict.id), variant: 'secondary' },
            ]}
          />
        ))}
      </div>
    )}
  </div>
)}
```

### Risk Assessment Tab
```tsx
{activeTab === 'risks' && (
  <div>
    {risks.length === 0 ? (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p>✓ No risk assessments yet</p>
      </div>
    ) : (
      <div className="space-y-6">
        {risks.map(risk => (
          <div key={risk.id} className="border border-[var(--color-border)] rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">
                  Risk Score: {risk.riskScore}/100
                </h4>
                <p className={cn(
                  'text-sm font-medium mt-1',
                  risk.riskLevel === 'critical' ? 'text-[#c92a2a]' :
                  risk.riskLevel === 'high' ? 'text-[#e67700]' :
                  risk.riskLevel === 'medium' ? 'text-[#f59f00]' :
                  'text-[#2d6a4f]'
                )}>
                  {risk.riskLevel.toUpperCase()} RISK
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--color-text-muted)]">Confidence</div>
                <div className="text-lg font-bold text-[var(--color-text-primary)]">{risk.confidence}%</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="w-full bg-[var(--color-surface-overlay)] rounded-full h-3">
                <div
                  className={cn(
                    'h-3 rounded-full',
                    risk.riskLevel === 'critical' ? 'bg-[#c92a2a]' :
                    risk.riskLevel === 'high' ? 'bg-[#e67700]' :
                    risk.riskLevel === 'medium' ? 'bg-[#f59f00]' :
                    'bg-[#2d6a4f]'
                  )}
                  style={{ width: `${risk.riskScore}%` }}
                />
              </div>
            </div>

            <div className="bg-[var(--color-surface-overlay)] rounded p-3 mb-4">
              <h5 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">Key Risk Factors</h5>
              <ul className="space-y-1">
                {risk.factors.map((factor, i) => (
                  <li key={i} className="text-sm text-[var(--color-text-secondary)]">
                    • {factor}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary text-sm">
                Acknowledge & Review
              </button>
              <button className="btn btn-ghost text-sm">
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

### Deadlines Tab
```tsx
{activeTab === 'deadlines' && (
  <div>
    {deadlines.length === 0 ? (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p>✓ No pending deadlines</p>
      </div>
    ) : (
      <div className="space-y-3">
        {deadlines.map(deadline => (
          <IntelligenceAlert
            key={deadline.id}
            type="deadline"
            title={deadline.description}
            description={`Due: ${new Date(deadline.dueDate).toLocaleDateString()}`}
            details={`${Math.ceil((new Date(deadline.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining`}
            actions={[
              { label: 'Confirm Deadline', onClick: () => confirmDeadline(deadline.id) },
              { label: 'Reschedule', onClick: () => rescheduleDeadline(deadline.id), variant: 'secondary' },
              { label: 'Dismiss', onClick: () => dismissDeadline(deadline.id), variant: 'secondary' },
            ]}
          />
        ))}
      </div>
    )}
  </div>
)}
```

---

## 4. Admin Courts Page Enhancement

Update `/admin/courts/page.tsx` to show courts with actions:

```tsx
'use client'
import { useState } from 'react'
import { Edit2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CourtsPage() {
  const [expandedCourt, setExpandedCourt] = useState<string | null>(null)
  const [courts, setCourts] = useState([...]) // fetch from API

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-display text-3xl font-semibold text-[var(--color-text-primary)]">
          Courts & Divisions
        </h1>
        <button className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Add Court
        </button>
      </div>

      <div className="space-y-2">
        {courts.map(court => (
          <div key={court.id} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCourt(expandedCourt === court.id ? null : court.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              <div className="text-left flex-1">
                <h3 className="font-semibold text-[var(--color-text-primary)]">{court.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{court.jurisdiction}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-[var(--color-accent-tint)] text-[var(--color-text-secondary)]">
                  {court.divisions.length} divisions
                </span>
                {expandedCourt === court.id ? (
                  <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
            </button>

            {expandedCourt === court.id && (
              <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6">
                <div className="grid gap-4">
                  {court.divisions.map(div => (
                    <div key={div.id} className="flex items-center justify-between p-3 bg-white dark:bg-[var(--color-surface)] rounded">
                      <div>
                        <h4 className="font-medium text-[var(--color-text-primary)]">{div.name}</h4>
                        <p className="text-xs text-[var(--color-text-muted)]">{div.divisionCode}</p>
                      </div>
                      <button className="btn btn-ghost btn-sm">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button className="btn btn-ghost btn-sm w-full justify-center">
                    <Plus className="w-4 h-4" /> Add Division
                  </button>
                </div>

                <div className="flex gap-2 mt-6 pt-6 border-t border-[var(--color-border)]">
                  <button className="btn btn-ghost">
                    <Edit2 className="w-4 h-4" /> Edit Court
                  </button>
                  <button className="btn btn-ghost text-[#c92a2a]">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 5. Implementation Checklist

- [ ] Create `IntelligenceAlert.tsx` component
- [ ] Update `/admin/page.tsx` with intelligence section
- [ ] Add tabs to `/admin/matters/[id]/page.tsx`
- [ ] Create tab components for conflicts, risks, deadlines
- [ ] Update `/admin/courts/page.tsx` with expansion pattern
- [ ] Create similar pages for:
  - `/admin/court-divisions/page.tsx`
  - `/admin/judges/page.tsx`
- [ ] Add API endpoints for:
  - GET `/api/conflicts?matter_id=...`
  - GET `/api/risk-assessments?matter_id=...`
  - GET `/api/deadlines?matter_id=...`
  - POST `/api/conflicts/{id}/acknowledge`
  - POST `/api/deadlines/{id}/confirm`
- [ ] Wire up Composition Root for real data
- [ ] Test dark mode on all new components
- [ ] Verify responsive design (mobile collapsing)

---

## Color Reference (From Your System)

```css
/* Status colors - use for alerts/badges */
--status-success: #2d6a4f;      /* Green - approved, clear */
--status-info: #1a4d6e;          /* Blue - informational */
--status-review: #6b3d99;        /* Purple - requires review */
--status-danger: #9b2335;        /* Red - conflict, critical */

/* Brand accent */
--color-brand: #a97d2f;          /* Brass - primary action */

/* Backgrounds */
--color-surface: #f5f5f5;        /* Light mode */
--color-surface-overlay: #e6e6e6; /* Hover state */

/* Text */
--color-text-primary: #2a2b2d;    /* Headers, important */
--color-text-secondary: #6b6e72;  /* Body text */
--color-text-muted: #8a8d91;      /* Secondary info */
```

---

## Notes

- Uses existing Tailwind + CSS variables (no breaking changes)
- Dark mode automatically supported via next-themes
- Leverages existing `btn` classes and `cn()` utility
- Reusable `IntelligenceAlert` component for all engine results
- Maintains existing visual hierarchy and spacing
- Responsive design (collapse tabs on mobile)
- Color-coded by alert type (conflict=red, risk=amber, deadline=sage)

