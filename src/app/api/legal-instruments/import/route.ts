import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requirePermissionApi } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { validateInstrumentJson, type InstrumentJson } from '@/lib/instrumentImport'

// Imports a legal instrument from the generic JSON shape (see
// src/lib/instrumentImport.ts), the primary way fee rules get entered.
// Supabase's REST client has no multi-table transaction, so safety comes
// from ordering: the new instrument is inserted as 'draft' first, and only
// flipped to 'active' (archiving the previous active instrument with the
// same slug) after every child row has been inserted successfully. If
// anything fails partway, the draft is left behind, never affects live
// calculations (resolveApplicableFees only reads 'active' instruments),
// and can be deleted via DELETE /api/legal-instruments/[id].
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('manage_fee_schedules')
  if ('response' in guard) return guard.response

  const body = await req.json()
  const validation = validateInstrumentJson(body)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 })
  }
  const json = body as InstrumentJson

  const supabase = createAdminClient()

  const { data: instrument, error: instrumentError } = await supabase
    .from('legal_instruments')
    .insert({
      slug: json.instrument.slug,
      name: json.instrument.name,
      authority: json.instrument.authority || null,
      instrument_type: json.instrument.instrument_type || null,
      version: json.instrument.version,
      effective_date: json.instrument.effective_date || null,
      expiry_date: json.instrument.expiry_date || null,
      source_note: json.instrument.source_note || null,
      status: 'draft',
      imported_by: guard.profile.id,
    })
    .select()
    .single()
  if (instrumentError || !instrument) {
    return NextResponse.json({ error: instrumentError?.message || 'Could not create instrument' }, { status: 500 })
  }

  const scheduleIdMap = new Map<string, string>()
  for (const s of json.schedules) {
    const { data, error } = await supabase
      .from('fee_schedules')
      .insert({ instrument_id: instrument.id, number: s.number, title: s.title, description: s.description || null })
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: `Failed inserting schedule "${s.id}": ${error?.message}`, draftInstrumentId: instrument.id }, { status: 500 })
    }
    scheduleIdMap.set(s.id, data.id)
  }

  const ruleIdMap = new Map<string, string>()
  for (const r of json.rules) {
    const scheduleId = scheduleIdMap.get(r.schedule)
    const { data, error } = await supabase
      .from('fee_rules')
      .insert({
        schedule_id: scheduleId,
        paragraph: r.paragraph || null,
        name: r.name,
        calculation_type: r.calculation_type,
        band_mode: r.band_mode || null,
        minimum: r.minimum ?? null,
        maximum: r.maximum ?? null,
        fixed_amount: r.fixed_amount ?? null,
        unit_rate: r.unit_rate ?? null,
        currency: r.currency || 'KES',
      })
      .select('id')
      .single()
    if (error || !data) {
      return NextResponse.json({ error: `Failed inserting rule "${r.id}": ${error?.message}`, draftInstrumentId: instrument.id }, { status: 500 })
    }
    ruleIdMap.set(r.id, data.id)
  }

  if (json.bands.length > 0) {
    const bandRows = json.bands.map((b) => ({
      rule_id: ruleIdMap.get(b.rule),
      from_value: b.from,
      to_value: b.to ?? null,
      rate: b.rate ?? null,
      flat_amount: b.flat_amount ?? null,
      sequence: b.sequence,
    }))
    const { error } = await supabase.from('fee_rule_bands').insert(bandRows)
    if (error) return NextResponse.json({ error: `Failed inserting bands: ${error.message}`, draftInstrumentId: instrument.id }, { status: 500 })
  }

  if (json.conditions.length > 0) {
    const conditionRows = json.conditions.map((c) => ({
      rule_id: ruleIdMap.get(c.rule),
      field: c.field,
      operator: c.operator,
      value: c.value,
    }))
    const { error } = await supabase.from('fee_rule_conditions').insert(conditionRows)
    if (error) return NextResponse.json({ error: `Failed inserting conditions: ${error.message}`, draftInstrumentId: instrument.id }, { status: 500 })
  }

  if (json.explanations.length > 0) {
    const explanationRows = json.explanations.map((e) => ({
      rule_id: ruleIdMap.get(e.rule),
      plain_language: e.plain_language,
      legal_reference: e.legal_reference || null,
    }))
    const { error } = await supabase.from('fee_rule_explanations').insert(explanationRows)
    if (error) return NextResponse.json({ error: `Failed inserting explanations: ${error.message}`, draftInstrumentId: instrument.id }, { status: 500 })
  }

  // Everything landed, activate, and archive whatever was previously
  // active for this slug so resolveApplicableFees only ever sees one
  // active version at a time.
  await supabase.from('legal_instruments').update({ status: 'archived' }).eq('slug', json.instrument.slug).eq('status', 'active').neq('id', instrument.id)
  const { data: activated, error: activateError } = await supabase
    .from('legal_instruments')
    .update({ status: 'active' })
    .eq('id', instrument.id)
    .select()
    .single()
  if (activateError) return NextResponse.json({ error: activateError.message, draftInstrumentId: instrument.id }, { status: 500 })

  await logAudit({ table_name: 'legal_instruments', record_id: instrument.id, action: 'INSERT', new_data: { slug: json.instrument.slug, version: json.instrument.version } })

  return NextResponse.json(activated, { status: 201 })
}
