import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const ids = body?.ids as string[]
  const action = body?.action as 'delete' | 'restore'

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }
  if (!['delete', 'restore'].includes(action)) {
    return NextResponse.json({ error: 'action must be "delete" or "restore"' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const update = action === 'delete' ? { deleted_at: new Date().toISOString() } : { deleted_at: null }

  const { error } = await supabase.from('submissions').update(update).in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const id of ids) {
    await logAudit({ table_name: 'submissions', record_id: id, action: action === 'delete' ? 'DELETE' : 'UPDATE', new_data: update })
  }

  return NextResponse.json({ success: true, count: ids.length })
}
