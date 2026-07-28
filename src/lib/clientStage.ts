// ============================================================
// CLIENT-FACING STAGE LABELS
// ============================================================
// The internal matter lifecycle (src/lib/matterLifecycle.ts) includes stages
// a client should never see by name, "conflict check" is an internal
// professional-conduct step, not a client-facing status. The portal maps
// every internal stage to language written for the client.

import type { MatterStage } from './matterLifecycle'

export interface ClientStageMeta {
  label: string
  description: string
  tone: 'progress' | 'active' | 'paused' | 'done'
}

const CLIENT_STAGES: Record<MatterStage, ClientStageMeta> = {
  lead: { label: 'Received', description: 'We have received your instruction and will be in touch.', tone: 'progress' },
  conflict_check: { label: 'Under Review', description: 'Your instruction is being reviewed by our team.', tone: 'progress' },
  engagement_letter: { label: 'Onboarding', description: 'We are preparing your engagement letter.', tone: 'progress' },
  retainer_pending: { label: 'Awaiting Retainer', description: 'Waiting on the retainer to begin work on your matter.', tone: 'progress' },
  open: { label: 'Active', description: 'Your matter is being actively worked on.', tone: 'active' },
  on_hold: { label: 'On Hold', description: 'Work on your matter is temporarily paused.', tone: 'paused' },
  closed: { label: 'Concluded', description: 'This matter has been concluded.', tone: 'done' },
  declined: { label: 'Not Proceeding', description: 'We were unable to take this matter on.', tone: 'done' },
  archived: { label: 'Concluded', description: 'This matter has been concluded.', tone: 'done' },
}

export function clientStageMeta(stage: string): ClientStageMeta {
  return CLIENT_STAGES[stage as MatterStage] || { label: 'In Progress', description: '', tone: 'progress' }
}
