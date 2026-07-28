import { createAdminClient } from './supabase'

export interface Revision {
  id: string
  table_name: string
  record_id: string
  data: Record<string, unknown>
  note: string | null
  created_by: string | null
  created_at: string
  author?: { full_name: string } | null
}

/**
 * Snapshots the given fields of a record BEFORE they're overwritten.
 * Call this right before applying an update, passing the record's
 * current (pre-update) values for the fields you want versioned.
 */
export async function saveRevision(
  tableName: string,
  recordId: string,
  data: Record<string, unknown>,
  createdBy?: string | null,
  note?: string
): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('content_revisions').insert({
    table_name: tableName,
    record_id: recordId,
    data,
    note: note || null,
    created_by: createdBy || null,
  })
}

export async function getRevisions(tableName: string, recordId: string): Promise<Revision[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('content_revisions')
    .select('*, author:profiles(full_name)')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function getRevision(id: string): Promise<Revision | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('content_revisions').select('*').eq('id', id).single()
  return data || null
}
