import { createAdminClient } from './supabase'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export interface AuditEntry {
  table_name: string
  record_id?: string | null
  action: AuditAction
  old_data?: unknown
  new_data?: unknown
  performed_by?: string | null
}

/**
 * Writes a row to the `audit_logs` table. This table already existed in the
 * schema but nothing ever wrote to it, this is the single place that does.
 * Never throws: an audit-log failure should never break the actual mutation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_logs').insert({
      table_name: entry.table_name,
      record_id: entry.record_id || null,
      action: entry.action,
      old_data: entry.old_data ?? null,
      new_data: entry.new_data ?? null,
      performed_by: entry.performed_by || null,
    })
  } catch (err) {
    console.warn('Audit log write failed:', err)
  }
}
