import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireAdminApi, getSessionProfile } from '@/lib/auth'

interface RouteCtx { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const { data, error } = await db
    .from('pupillage_applications')
    .select(`
      *,
      pupil_master:pupil_masters(
        *,
        team_member:team_members(id, full_name, email, phone, avatar_url, position, bar_number, years_experience, specializations)
      ),
      centre:pupillage_centres(*),
      checklist:pupillage_checklist_items(*),
      events:pupillage_events(*, actor:profiles(id, full_name)),
      workbook:pupillage_workbook_entries(*)
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const guard = await requireAdminApi()
  if ('response' in guard) return guard.response

  const db = createAdminClient()
  const body = await req.json()
  const { action, ...updateData } = body

  if (action === 'run_eligibility_check') {
    return runEligibilityCheck(db, params.id, guard.profile.id)
  }

  if (action === 'advance_status') {
    return advanceStatus(db, params.id, updateData.new_status, guard.profile)
  }

  if (action === 'generate_deed') {
    return generateDeed(db, params.id, guard.profile.id)
  }

  if (action === 'onboard') {
    return onboardPupil(db, params.id, guard.profile)
  }

  // Generic field update
  const { data, error } = await db
    .from('pupillage_applications')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── Eligibility Check ───────────────────────────────────────
async function runEligibilityCheck(
  db: ReturnType<typeof createAdminClient>,
  appId: string,
  actorId: string
) {
  const { data: app } = await db
    .from('pupillage_applications')
    .select('*, pupil_master:pupil_masters(*, team_member:team_members(full_name))')
    .eq('id', appId)
    .single()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const pm = app.pupil_master
  const checks: { name: string; passed: boolean; detail: string }[] = []

  // Check 1: 5+ years of practice
  checks.push({
    name: 'Years of practice',
    passed: pm.years_of_practice >= 5,
    detail: `${pm.years_of_practice} years (min 5 required)`,
  })

  // Check 2: Current PC not expired
  const pcValid = pm.pc_valid_to ? new Date(pm.pc_valid_to) >= new Date() : false
  checks.push({
    name: 'Practising Certificate validity',
    passed: pcValid,
    detail: pm.pc_valid_to ? `Valid to ${pm.pc_valid_to}` : 'No PC on record',
  })

  // Check 3: Fewer than max_pupils active
  const { count } = await db
    .from('pupillage_applications')
    .select('id', { count: 'exact', head: true })
    .eq('pupil_master_id', pm.id)
    .in('status', ['active', 'approved', 'deed_executed', 'submitted_to_ksl'])
    .neq('id', appId)

  const activeCount = count || 0
  checks.push({
    name: 'Current pupil count',
    passed: activeCount < pm.max_pupils,
    detail: `${activeCount} active of ${pm.max_pupils} max`,
  })

  const allPassed = checks.every(c => c.passed)
  const result = { passed: allPassed, checks }

  await db
    .from('pupillage_applications')
    .update({
      eligibility_checked_at: new Date().toISOString(),
      eligibility_result: result,
      status: allPassed ? 'particulars_review' : app.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appId)

  await db.from('pupillage_events').insert({
    application_id: appId,
    type: 'eligibility_check',
    detail: allPassed ? 'All eligibility checks passed' : `Eligibility check failed: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`,
    actor_id: actorId,
  })

  return NextResponse.json(result)
}

// ── Status Advancement ──────────────────────────────────────
const STATUS_ORDER = [
  'draft', 'submitted', 'eligibility_check', 'particulars_review',
  'deed_generated', 'documents_pending', 'ready_for_signature',
  'deed_executed', 'submitted_to_ksl', 'approved', 'active',
  'completed',
]

async function advanceStatus(
  db: ReturnType<typeof createAdminClient>,
  appId: string,
  newStatus: string,
  actor: { id: string; fullName: string }
) {
  if (!newStatus || !STATUS_ORDER.includes(newStatus)) {
    return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 })
  }

  const timestampField: Record<string, string> = {
    submitted: 'submitted_at',
    approved: 'approved_at',
    completed: 'completed_at',
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (timestampField[newStatus]) {
    update[timestampField[newStatus]] = new Date().toISOString()
  }

  const { data, error } = await db
    .from('pupillage_applications')
    .update(update)
    .eq('id', appId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('pupillage_events').insert({
    application_id: appId,
    type: 'status_changed',
    detail: `Status changed to "${newStatus}" by ${actor.fullName}`,
    actor_id: actor.id,
  })

  return NextResponse.json(data)
}

// ── Deed Generation ─────────────────────────────────────────
async function generateDeed(
  db: ReturnType<typeof createAdminClient>,
  appId: string,
  actorId: string
) {
  const { data: app } = await db
    .from('pupillage_applications')
    .select(`
      *,
      pupil_master:pupil_masters(*, team_member:team_members(full_name, bar_number)),
      centre:pupillage_centres(*)
    `)
    .eq('id', appId)
    .single()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const pm = app.pupil_master
  const centre = app.centre
  const rotations = (app.practice_rotations || []) as { area: string; duration_months: number; order: number }[]

  const deedHtml = buildDeedHtml({
    effectiveDate: app.term_start_date || new Date().toISOString().split('T')[0],
    firmName: centre?.firm_name || 'Oringe Waswa & Opany Advocates',
    firmAddress: centre?.physical_address || centre?.postal_address || '',
    pupilMasterName: pm?.team_member?.full_name || '',
    pupilMasterLSK: pm?.lsk_membership_no || '',
    pupilName: app.pupil_full_name,
    pupilAdmissionNo: app.pupil_ksl_admission_no || '',
    termStart: app.term_start_date || '',
    termEnd: app.term_end_date || '',
    stipendAmount: app.monthly_stipend || 0,
    paymentDay: app.stipend_payment_day || 25,
    rotations,
  })

  await db
    .from('pupillage_applications')
    .update({
      deed_generated_at: new Date().toISOString(),
      status: 'deed_generated',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appId)

  await db.from('pupillage_events').insert({
    application_id: appId,
    type: 'deed_generated',
    detail: 'Pupillage Deed (Form C) generated',
    actor_id: actorId,
  })

  return NextResponse.json({ deed_html: deedHtml })
}

function buildDeedHtml(d: {
  effectiveDate: string
  firmName: string
  firmAddress: string
  pupilMasterName: string
  pupilMasterLSK: string
  pupilName: string
  pupilAdmissionNo: string
  termStart: string
  termEnd: string
  stipendAmount: number
  paymentDay: number
  rotations: { area: string; duration_months: number; order: number }[]
}) {
  const formatDate = (s: string) => {
    if (!s) return '_______________'
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const rotationRows = d.rotations.length > 0
    ? d.rotations.map(r => `<tr><td style="padding:4px 8px;border:1px solid #ccc">${r.order}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.area}</td><td style="padding:4px 8px;border:1px solid #ccc">${r.duration_months} month(s)</td></tr>`).join('')
    : '<tr><td colspan="3" style="padding:4px 8px;border:1px solid #ccc;text-align:center">No rotations specified</td></tr>'

  return `
<div style="font-family:'Times New Roman',serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.8;color:#111">
  <h1 style="text-align:center;font-size:18px;margin-bottom:4px">FORM C</h1>
  <h2 style="text-align:center;font-size:16px;margin-bottom:4px">PUPILLAGE DEED</h2>
  <p style="text-align:center;font-size:12px;margin-bottom:24px">(Made pursuant to Regulation 18(1) of the KSL Training Programmes Regulations, 2015)</p>

  <p>THIS DEED is made the <strong>${formatDate(d.effectiveDate)}</strong></p>

  <p><strong>BETWEEN:</strong></p>
  <p><strong>${d.firmName}</strong> of ${d.firmAddress || '_______________'} (hereinafter referred to as "<strong>the Firm</strong>") through <strong>${d.pupilMasterName}</strong>, Advocate, LSK Membership No. <strong>${d.pupilMasterLSK}</strong> (hereinafter referred to as "<strong>the Pupil Master</strong>")</p>
  <p><strong>AND</strong></p>
  <p><strong>${d.pupilName}</strong>, KSL Admission No. <strong>${d.pupilAdmissionNo || '_______________'}</strong> (hereinafter referred to as "<strong>the Pupil</strong>")</p>

  <h3 style="margin-top:24px">1. TERM</h3>
  <p>1.1 The pupillage shall commence on <strong>${formatDate(d.termStart)}</strong> and shall end on <strong>${formatDate(d.termEnd)}</strong>, subject to extension or earlier termination in accordance with the governing framework.</p>

  <h3>2. OBLIGATIONS OF THE PUPIL</h3>
  <p>2.1 The Pupil shall diligently and faithfully serve the Pupil Master and the Firm during the term of pupillage.</p>
  <p>2.2 The Pupil shall maintain a Work Book as provided by the School recording all tasks, assignments, and activities undertaken during the pupillage.</p>
  <p>2.3 The Pupil shall at all times conduct themselves in a manner befitting the legal profession and in compliance with the Advocates Act (Cap. 16) and the KSL Pupillage Guidelines.</p>
  <p>2.4 The Pupil shall observe all confidentiality obligations in relation to client matters and firm business.</p>

  <h3>3. OBLIGATIONS OF THE PUPIL MASTER / FIRM</h3>
  <p>3.1 The Pupil Master shall provide the Pupil with practical training across the practice areas set out in Schedule 1 hereto.</p>
  <p>3.2 The Pupil Master shall review and sign off the Pupil's Work Book on a monthly basis.</p>
  <p>3.3 The Firm shall provide the Pupil with adequate workspace, resources, and access to the Firm's systems as necessary for the pupillage.</p>

  <h3>4. STIPEND</h3>
  <p>4.1 The Firm shall pay the Pupil a monthly stipend of <strong>KES ${Number(d.stipendAmount).toLocaleString()}</strong>, payable on or before the <strong>${d.paymentDay}${d.paymentDay === 1 ? 'st' : d.paymentDay === 2 ? 'nd' : d.paymentDay === 3 ? 'rd' : 'th'}</strong> day of each month.</p>

  <h3>5. DATA PROTECTION</h3>
  <p>5.1 Both parties shall comply with the Data Protection Act, 2019 in relation to any personal data processed during the pupillage.</p>

  <h3>6. MALPRACTICE</h3>
  <p>6.1 Any act of malpractice by the Pupil as defined under the KSL Pupillage Guidelines shall be reported to the Director, Kenya School of Law, and may result in disciplinary action including termination of the pupillage.</p>

  <h3>7. TERMINATION</h3>
  <p>7.1 This Deed may be terminated by either party giving one month's written notice to the other party and to the Director, Kenya School of Law.</p>
  <p>7.2 The Pupil Master may terminate this Deed immediately upon the Pupil's commission of gross malpractice or breach of professional ethics.</p>

  <h3>8. GOVERNING FRAMEWORK</h3>
  <p>8.1 This Deed is governed by the Advocates Act (Cap. 16), the Kenya School of Law Act, 2012, the KSL Training Programmes Regulations, 2015, and the KSL Pupillage Guidelines (October 2023).</p>

  <h3>9. GENERAL</h3>
  <p>9.1 This Deed constitutes the entire agreement between the parties in relation to the pupillage.</p>
  <p>9.2 Any amendment to this Deed shall be in writing and signed by both parties.</p>

  <h3 style="margin-top:32px">SCHEDULE 1 — SCOPE OF TRAINING</h3>
  <table style="width:100%;border-collapse:collapse;margin:12px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:4px 8px;border:1px solid #ccc;text-align:left">Order</th>
        <th style="padding:4px 8px;border:1px solid #ccc;text-align:left">Practice Area</th>
        <th style="padding:4px 8px;border:1px solid #ccc;text-align:left">Duration</th>
      </tr>
    </thead>
    <tbody>${rotationRows}</tbody>
  </table>

  <div style="margin-top:48px">
    <h3>SIGNATURES</h3>
    <div style="display:flex;gap:40px;flex-wrap:wrap;margin-top:24px">
      <div style="flex:1;min-width:200px">
        <p><strong>PUPIL:</strong></p>
        <p style="border-bottom:1px solid #333;min-height:40px"></p>
        <p>${d.pupilName}</p>
        <p>Date: _______________</p>
      </div>
      <div style="flex:1;min-width:200px">
        <p><strong>PUPIL MASTER:</strong></p>
        <p style="border-bottom:1px solid #333;min-height:40px"></p>
        <p>${d.pupilMasterName}</p>
        <p>Date: _______________</p>
      </div>
      <div style="flex:1;min-width:200px">
        <p><strong>WITNESS:</strong></p>
        <p style="border-bottom:1px solid #333;min-height:40px"></p>
        <p>Name: _______________</p>
        <p>Date: _______________</p>
      </div>
    </div>
  </div>
</div>`
}

// ── Auto-Onboarding ─────────────────────────────────────────
async function onboardPupil(
  db: ReturnType<typeof createAdminClient>,
  appId: string,
  actor: { id: string; fullName: string }
) {
  const { data: app } = await db
    .from('pupillage_applications')
    .select('*, pupil_master:pupil_masters(team_member:team_members(full_name))')
    .eq('id', appId)
    .single()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  // Update the profile to pupil role
  await db
    .from('profiles')
    .update({ role: 'pupil' })
    .eq('id', app.pupil_profile_id)

  // Create or update team_members record for the pupil
  const { data: existingTm } = await db
    .from('team_members')
    .select('id')
    .eq('email', app.pupil_email)
    .maybeSingle()

  let teamMemberId = existingTm?.id

  if (!teamMemberId) {
    const { data: newTm } = await db
      .from('team_members')
      .insert({
        profile_id: app.pupil_profile_id,
        full_name: app.pupil_full_name,
        email: app.pupil_email,
        phone: app.pupil_phone,
        position: 'Pupil',
        department: 'Legal',
        seniority: 'pupil',
        national_id: app.pupil_id_number,
        kra_pin: app.pupil_kra_pin,
        date_of_birth: app.pupil_dob,
        joining_date: app.term_start_date,
        exit_date: app.term_end_date,
        employment_type: 'contract',
        employment_status: 'active',
        is_active: true,
        is_visible: false,
      })
      .select('id')
      .single()
    teamMemberId = newTm?.id
  } else {
    await db
      .from('team_members')
      .update({
        seniority: 'pupil',
        joining_date: app.term_start_date,
        exit_date: app.term_end_date,
        employment_status: 'active',
        is_active: true,
      })
      .eq('id', teamMemberId)
  }

  // Create compliance report with due date (term end + 30 days)
  if (app.term_end_date) {
    const dueDate = new Date(app.term_end_date)
    dueDate.setDate(dueDate.getDate() + 30)

    await db.from('pupillage_compliance_reports').upsert({
      application_id: appId,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'pending',
    }, { onConflict: 'application_id' })
  }

  await db
    .from('pupillage_applications')
    .update({
      status: 'active',
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', appId)

  await db.from('pupillage_events').insert({
    application_id: appId,
    type: 'onboarded',
    detail: `Pupil onboarded by ${actor.fullName}. Profile set to pupil role, team member record created.`,
    actor_id: actor.id,
  })

  return NextResponse.json({ success: true, team_member_id: teamMemberId })
}
