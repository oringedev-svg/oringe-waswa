import type { SupabaseClient } from '@supabase/supabase-js'

type Assignment = { id: string; assignment_type?: string | null; notes?: string | null }

/** Server-side completion guard. The default rule is intentionally strict
 * about tasks/deliverables only when those records exist: legacy assignments
 * continue to work while new V3 assignments use their configured rule. */
export async function checkAssignmentCompletion(supabase: SupabaseClient, assignment: Assignment) {
  const [{ data: rule }, { data: inputs }, { data: tasks }, { data: deliverables }] = await Promise.all([
    supabase.from('completion_rules').select('*').eq('assignment_type', assignment.assignment_type || 'GENERAL').maybeSingle(),
    supabase.from('assignment_inputs').select('id, required, status').eq('assignment_id', assignment.id),
    supabase.from('tasks').select('id, status, actual_hours').eq('assignment_id', assignment.id),
    supabase.from('deliverables').select('id, required, status').eq('assignment_id', assignment.id),
  ])

  const effectiveRule = rule || {
    requires_deliverables: true, requires_all_tasks_done: true, requires_checklist: false,
    requires_dependencies_met: true, requires_time_logged: false, requires_notes: false,
    requires_client_confirmation: false,
  }
  const missingInputs = (inputs || []).filter(i => i.required && i.status !== 'PROVIDED')
  if (missingInputs.length) return { ok: false, error: 'inputs_missing', missingInputs: missingInputs.map(i => i.id) }
  if (effectiveRule.requires_deliverables && (deliverables || []).some(d => d.required && d.status !== 'PRODUCED')) {
    return { ok: false, error: 'deliverables_incomplete' }
  }
  if (effectiveRule.requires_all_tasks_done && (tasks || []).some(t => t.status !== 'DONE')) {
    return { ok: false, error: 'tasks_incomplete' }
  }
  if (effectiveRule.requires_time_logged && !(tasks || []).some(t => Number(t.actual_hours || 0) > 0)) {
    return { ok: false, error: 'time_not_logged' }
  }
  if (effectiveRule.requires_notes && !assignment.notes?.trim()) return { ok: false, error: 'notes_required' }
  // Checklist, dependency and client confirmation are intentionally explicit
  // configuration hooks; no inferred proxy is permitted for these gates.
  if (effectiveRule.requires_checklist) return { ok: false, error: 'checklist_required' }
  if (effectiveRule.requires_dependencies_met) {
    const { data: dependencies } = await supabase.from('assignment_dependencies').select('id, status, dependency_type').eq('assignment_id', assignment.id)
    if ((dependencies || []).some(d => d.dependency_type === 'BLOCKS' && d.status !== 'APPROVED')) return { ok: false, error: 'dependencies_unmet' }
  }
  if (effectiveRule.requires_client_confirmation) return { ok: false, error: 'client_confirmation_required' }
  return { ok: true }
}
