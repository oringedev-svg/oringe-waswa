import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile } from '@/lib/auth'

// Move a matter to a different pipeline stage (forward or backward)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const profile = await getSessionProfile()
  if (!profile) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { stage_id, reason } = await req.json()

  if (!stage_id) {
    return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch current matter
  const { data: matter, error: fetchError } = await supabase
    .from('legal_matters')
    .select('id, current_stage_id, status')
    .eq('id', params.id)
    .single()

  if (fetchError || !matter) {
    return NextResponse.json({ error: 'Matter not found' }, { status: 404 })
  }

  // Verify stage exists
  const { data: stage, error: stageError } = await supabase
    .from('pipeline_stages')
    .select('id, key, label')
    .eq('id', stage_id)
    .single()

  if (stageError || !stage) {
    return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
  }

  // Get current stage info for logging
  const { data: currentStage } = await supabase
    .from('pipeline_stages')
    .select('key, label')
    .eq('id', matter.current_stage_id)
    .single()

  // Update matter
  const { data: updated, error: updateError } = await supabase
    .from('legal_matters')
    .update({
      current_stage_id: stage_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log stage transition
  const { error: historyError } = await supabase
    .from('matter_stage_history')
    .insert({
      matter_id: params.id,
      from_stage: matter.current_stage_id,
      to_stage: stage_id,
      changed_by: profile.id,
    })

  if (historyError) {
    console.error('Failed to log stage history:', historyError)
    // Don't fail if history logging fails, the main update succeeded
  }

  return NextResponse.json({
    success: true,
    message: `Matter moved from ${currentStage?.label} to ${stage.label}${reason ? ': ' + reason : ''}`,
    matter: updated,
  })
}
