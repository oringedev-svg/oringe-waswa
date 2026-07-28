import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_member_skills')
    .select('skill_id, level, verified, years, last_used, skill:skills(id, name)')
    .eq('team_member_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Replaces the full set of skills (each with its own level/verified/years)
// in one call, same simple-multi-select convention as industries.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermissionApi('manage_lawyers')
  if ('response' in guard) return guard.response

  const { skills } = await req.json()
  if (!Array.isArray(skills)) return NextResponse.json({ error: 'skills must be an array' }, { status: 400 })

  const supabase = createAdminClient()
  await supabase.from('team_member_skills').delete().eq('team_member_id', params.id)
  if (skills.length > 0) {
    const { error } = await supabase.from('team_member_skills').insert(
      skills.map((s: { skill_id: string; level?: string; verified?: boolean; years?: number; last_used?: string }) => ({
        team_member_id: params.id,
        skill_id: s.skill_id,
        level: s.level || null,
        verified: s.verified || false,
        years: s.years ?? null,
        last_used: s.last_used || null,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await logAudit({ table_name: 'team_member_skills', record_id: params.id, action: 'UPDATE', new_data: { skills } })
  return NextResponse.json({ success: true })
}
