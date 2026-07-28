-- ============================================================
-- DEMO DATA SEED, realistic practice state
-- ============================================================
-- Run in the Supabase SQL Editor. Safe to run once; re-running will
-- add duplicate submissions/matters (profiles and subscribers are
-- conflict-safe on email).
--
-- What this creates, deliberately shaped to exercise every feature:
--   - 4 client profiles on your real emails (no portal login yet, so
--     "Invite to Portal" works end-to-end into real inboxes)
--   - 7 submissions: 3 pending (triage queue), the rest promoted
--   - 6 matters across the whole lifecycle: open, stalled, in conflict
--     check (with a PENDING partner decision), retainer pending with an
--     OVERDUE invoice, one closed with a PAID invoice this month, and
--     one active matter with NO attorney assigned
--   - Full stage history with realistic dwell times (bottleneck stats)
--   - Time entries: unbilled (~KES 69,000), billed, and drafted
--   - Invoices: paid, sent, sent-overdue, and draft
--   - Newsletter subscribers including your real emails

DO $$
DECLARE
  v_admin UUID;
  v_atty1 UUID;  -- partner
  v_atty2 UUID;  -- associate
  p_kerry UUID; p_evans UUID; p_diana UUID; p_nathan UUID;
  s1 UUID; s2 UUID; s3 UUID; s4 UUID; s5 UUID; s6 UUID; s7 UUID;
  m1 UUID; m2 UUID; m3 UUID; m4 UUID; m5 UUID; m6 UUID;
  inv_paid UUID; inv_overdue UUID; inv_sent UUID; inv_draft UUID;
BEGIN
  SELECT id INTO v_admin FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_atty1 FROM team_members WHERE full_name = 'Oj' LIMIT 1;
  IF v_atty1 IS NULL THEN SELECT id INTO v_atty1 FROM team_members ORDER BY created_at LIMIT 1; END IF;
  SELECT id INTO v_atty2 FROM team_members WHERE full_name = 'Decra Mokorah' LIMIT 1;
  IF v_atty2 IS NULL THEN v_atty2 := v_atty1; END IF;

  -- ============================================================
  -- CLIENT PROFILES (your real emails; user_id stays NULL so the
  -- portal invite flow is fully testable)
  -- ============================================================
  INSERT INTO profiles (full_name, email, phone, role)
  VALUES ('Kerry Kariuki', 'decrakerry@gmail.com', '+254 722 111 001', 'client')
  ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO p_kerry;

  INSERT INTO profiles (full_name, email, phone, role)
  VALUES ('Evans Nyamweya', 'evanyam@gmail.com', '+254 722 111 002', 'client')
  ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO p_evans;

  INSERT INTO profiles (full_name, email, phone, role)
  VALUES ('Diana Kerubo', 'decrakerubo2001@gmail.com', '+254 722 111 003', 'client')
  ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO p_diana;

  INSERT INTO profiles (full_name, email, phone, role)
  VALUES ('Nathan Otieno', 'entr.legal.partner@gmail.com', '+254 722 111 004', 'client')
  ON CONFLICT (email) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO p_nathan;

  -- ============================================================
  -- SUBMISSIONS, 3 fresh and pending (triage), 4 older and progressed
  -- ============================================================
  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1001', 'contact', 'accepted', 'Kerry Kariuki', 'decrakerry@gmail.com', '+254 722 111 001',
    '{"matter_type":"Family Law","message":"My father passed away in March leaving land in Kisii and a bank account. The family disagrees on distribution and I need help with the succession process."}',
    NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days')
  RETURNING id INTO s1;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1002', 'appointment', 'accepted', 'Evans Nyamweya', 'evanyam@gmail.com', '+254 722 111 002',
    '{"matter_type":"Property Law","message":"I am taking a 6-year commercial lease on a shop in Westlands and want the lease reviewed before I sign.","preferred_date":"2026-06-22"}',
    NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days')
  RETURNING id INTO s2;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1003', 'contact', 'accepted', 'Nathan Otieno', 'entr.legal.partner@gmail.com', '+254 722 111 004',
    '{"matter_type":"Corporate Law","message":"Nyota Ventures Ltd is rebranding and we need the company name changed at the registry, plus updated CR12 and board resolutions."}',
    NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days')
  RETURNING id INTO s3;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1004', 'contact', 'under_review', 'Diana Kerubo', 'decrakerubo2001@gmail.com', '+254 722 111 003',
    '{"matter_type":"Civil Litigation","message":"A neighbour has fenced off a section of my plot in Nyamira and ignored two demand letters. I want to sue for trespass and recover the land."}',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days')
  RETURNING id INTO s4;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1005', 'contact', 'pending', 'Grace Wanjiru', 'grace.wanjiru@example.com', '+254 733 222 005',
    '{"matter_type":"Employment Law","message":"I was dismissed without notice after 7 years at my employer. I believe it was unfair termination and want to understand my options."}',
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
  RETURNING id INTO s5;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1006', 'appointment', 'pending', 'Baraka Ochieng', 'baraka.ochieng@example.com', '+254 733 222 006',
    '{"matter_type":"Nonprofit Advisory","message":"Our community group in Homa Bay wants to register as a PBO. We need guidance on the constitution and registration forms.","preferred_date":"2026-07-20"}',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
  RETURNING id INTO s6;

  INSERT INTO submissions (tracking_code, type, status, submitter_name, submitter_email, submitter_phone, data, created_at, updated_at)
  VALUES ('OWA-TRK-1007', 'job', 'pending', 'Faith Chebet', 'faith.chebet@example.com', '+254 733 222 007',
    '{"position":"Legal Associate","message":"LLB (Hons) Moi University, KSL 2024, admitted 2025. Two years litigation experience. CV attached via email."}',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  RETURNING id INTO s7;

  INSERT INTO submission_updates (submission_id, status, message, is_public, created_by, created_at) VALUES
    (s1, 'accepted', 'Thank you for reaching out. We have reviewed your succession inquiry and opened a matter, your advocate will contact you within two business days.', true, v_admin, NOW() - INTERVAL '38 days'),
    (s4, 'under_review', 'We have received your trespass complaint and the demand letters. The matter is under internal review for conflicts before we can formally take it on.', true, v_admin, NOW() - INTERVAL '3 days');

  -- ============================================================
  -- APPOINTMENTS
  -- ============================================================
  INSERT INTO appointments (submission_id, client_name, client_email, client_phone, matter_type, description, status, assigned_attorney_id, scheduled_date, scheduled_time, location, created_at) VALUES
    (s2, 'Evans Nyamweya', 'evanyam@gmail.com', '+254 722 111 002', 'property', 'Initial consultation, Westlands commercial lease review', 'completed', v_atty2, (NOW() - INTERVAL '22 days')::date, '10:00', 'Nairobi office', NOW() - INTERVAL '25 days'),
    (s6, 'Baraka Ochieng', 'baraka.ochieng@example.com', '+254 733 222 006', 'other', 'PBO registration guidance, community group from Homa Bay', 'pending', NULL, (NOW() + INTERVAL '6 days')::date, '14:30', 'Nairobi office', NOW() - INTERVAL '2 days');

  -- ============================================================
  -- MATTERS, every lifecycle stage, every health state
  -- ============================================================

  -- M1: OPEN, healthy, has billed + unbilled time. Kerry Kariuki.
  INSERT INTO legal_matters (matter_number, title, type, status, client_id, client_name, assigned_attorney_id, opening_date, description, submission_id, created_at, updated_at)
  VALUES ('OW-2026-8101', 'Kariuki Succession, Estate of the late J. Kariuki', 'family_law', 'open', p_kerry, 'Kerry Kariuki', v_atty1,
    (NOW() - INTERVAL '34 days')::date,
    'Succession cause for the estate of the late Joseph Kariuki: land parcel in Kisii and bank deposits. Grant of letters of administration to be sought; family consent forms in progress.',
    s1, NOW() - INTERVAL '40 days', NOW() - INTERVAL '2 days')
  RETURNING id INTO m1;

  -- M2: OPEN but drifting (no activity 10 days) -> "At risk". Evans Nyamweya.
  INSERT INTO legal_matters (matter_number, title, type, status, client_id, client_name, assigned_attorney_id, opening_date, description, submission_id, created_at, updated_at)
  VALUES ('OW-2026-8102', 'Nyamweya Commercial Lease Review, Westlands', 'property', 'open', p_evans, 'Evans Nyamweya', v_atty2,
    (NOW() - INTERVAL '20 days')::date,
    'Review of a 6-year commercial lease for retail premises in Westlands. Rent escalation clause and repair covenants flagged for renegotiation.',
    s2, NOW() - INTERVAL '25 days', NOW() - INTERVAL '10 days')
  RETURNING id INTO m2;

  -- M3: RETAINER PENDING and STALLED (45 days), with an overdue invoice. Nathan Otieno.
  INSERT INTO legal_matters (matter_number, title, type, status, client_id, client_name, assigned_attorney_id, opening_date, description, submission_id, created_at, updated_at)
  VALUES ('OW-2026-8103', 'Nyota Ventures Ltd, Change of Name and CR12', 'corporate', 'retainer_pending', p_nathan, 'Nyota Ventures Ltd (Nathan Otieno)', v_atty1,
    (NOW() - INTERVAL '58 days')::date,
    'Company name change at the Business Registration Service, updated CR12, and fresh board resolutions. Engagement letter signed; awaiting retainer payment before filing.',
    s3, NOW() - INTERVAL '60 days', NOW() - INTERVAL '45 days')
  RETURNING id INTO m3;

  -- M4: CONFLICT CHECK stage, NO attorney assigned, pending partner decision. Diana Kerubo.
  INSERT INTO legal_matters (matter_number, title, type, status, client_id, client_name, opening_date, description, submission_id, created_at, updated_at)
  VALUES ('OW-2026-8104', 'Kerubo v. Neighbour, Trespass and Recovery of Land', 'civil_litigation', 'conflict_check', p_diana, 'Diana Kerubo',
    (NOW() - INTERVAL '5 days')::date,
    'Trespass claim over a fenced-off section of a plot in Nyamira. Two demand letters ignored; client seeks recovery of land and damages.',
    s4, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days')
  RETURNING id INTO m4;

  -- M5: OPEN, direct staff entry (no submission), confidential litigation.
  INSERT INTO legal_matters (matter_number, title, type, status, client_name, opposing_party, court, case_number, assigned_attorney_id, opening_date, description, is_confidential, created_at, updated_at)
  VALUES ('OW-2026-8105', 'Wanjiru v. Otieno, Breach of Contract', 'civil_litigation', 'open', 'Grace Wanjiru', 'Samuel Otieno', 'Milimani Commercial Courts', 'HCCC/E512/2026', v_atty2,
    (NOW() - INTERVAL '15 days')::date,
    'Claim for breach of a supply contract. Plaint filed; defence expected within 14 days of service.',
    true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day')
  RETURNING id INTO m5;

  -- M6: CLOSED last month, fully billed and PAID this month.
  INSERT INTO legal_matters (matter_number, title, type, status, client_name, assigned_attorney_id, opening_date, closing_date, description, created_at, updated_at)
  VALUES ('OW-2026-8106', 'Baraza CBO, PBO Registration', 'other', 'closed', 'Baraza Community Organisation', v_atty1,
    (NOW() - INTERVAL '90 days')::date, (NOW() - INTERVAL '15 days')::date,
    'Registration of Baraza Community Organisation as a Public Benefit Organisation: constitution drafted, forms filed, certificate issued.',
    NOW() - INTERVAL '90 days', NOW() - INTERVAL '15 days')
  RETURNING id INTO m6;

  -- Link clients to their matters (portal access path)
  INSERT INTO matter_people (matter_id, profile_id, role) VALUES
    (m1, p_kerry, 'client'),
    (m2, p_evans, 'client'),
    (m3, p_nathan, 'client'),
    (m4, p_diana, 'client')
  ON CONFLICT (matter_id, profile_id) DO NOTHING;

  -- ============================================================
  -- STAGE HISTORY, realistic dwell times for cycle analytics
  -- ============================================================
  INSERT INTO matter_stage_history (matter_id, from_stage, to_stage, changed_by, created_at) VALUES
    -- M1: smooth 6-day intake, open for 30 days
    (m1, NULL, 'lead', v_admin, NOW() - INTERVAL '40 days'),
    (m1, 'lead', 'conflict_check', v_admin, NOW() - INTERVAL '38 days'),
    (m1, 'conflict_check', 'engagement_letter', v_admin, NOW() - INTERVAL '36 days'),
    (m1, 'engagement_letter', 'retainer_pending', v_admin, NOW() - INTERVAL '35 days'),
    (m1, 'retainer_pending', 'open', v_admin, NOW() - INTERVAL '34 days'),
    -- M2: 5-day intake, open 20 days
    (m2, NULL, 'lead', v_admin, NOW() - INTERVAL '25 days'),
    (m2, 'lead', 'conflict_check', v_admin, NOW() - INTERVAL '24 days'),
    (m2, 'conflict_check', 'engagement_letter', v_admin, NOW() - INTERVAL '22 days'),
    (m2, 'engagement_letter', 'open', v_admin, NOW() - INTERVAL '20 days'),
    -- M3: stuck at retainer for 45 days, the bottleneck story
    (m3, NULL, 'lead', v_admin, NOW() - INTERVAL '60 days'),
    (m3, 'lead', 'conflict_check', v_admin, NOW() - INTERVAL '58 days'),
    (m3, 'conflict_check', 'engagement_letter', v_admin, NOW() - INTERVAL '50 days'),
    (m3, 'engagement_letter', 'retainer_pending', v_admin, NOW() - INTERVAL '45 days'),
    -- M4: fresh, sitting in conflict check 3 days awaiting partner decision
    (m4, NULL, 'lead', v_admin, NOW() - INTERVAL '5 days'),
    (m4, 'lead', 'conflict_check', v_admin, NOW() - INTERVAL '3 days'),
    -- M5: staff-opened directly
    (m5, NULL, 'open', v_admin, NOW() - INTERVAL '15 days'),
    -- M6: full life, closed 15 days ago
    (m6, NULL, 'lead', v_admin, NOW() - INTERVAL '90 days'),
    (m6, 'lead', 'conflict_check', v_admin, NOW() - INTERVAL '88 days'),
    (m6, 'conflict_check', 'engagement_letter', v_admin, NOW() - INTERVAL '85 days'),
    (m6, 'engagement_letter', 'open', v_admin, NOW() - INTERVAL '82 days'),
    (m6, 'open', 'closed', v_admin, NOW() - INTERVAL '15 days');

  -- ============================================================
  -- CONFLICT CHECKS, one decided, one AWAITING PARTNER DECISION
  -- ============================================================
  INSERT INTO conflict_checks (matter_id, search_query, results, highest_risk, decision, decision_notes, decided_by, decided_at, checked_by, created_at) VALUES
    (m1, 'Kariuki', '[{"match_type":"Prospective Client / Intake","name":"Kerry Kariuki","detail":"contact submission","risk":"low"}]', 'low',
     'proceed', 'Only match is the client''s own intake record. No conflict.', v_admin, NOW() - INTERVAL '37 days', v_admin, NOW() - INTERVAL '38 days');

  INSERT INTO conflict_checks (matter_id, search_query, results, highest_risk, decision, checked_by, created_at) VALUES
    (m4, 'Kerubo', '[{"match_type":"Existing / Former Client","name":"Decra Kerubo","detail":"staff member shares a family name with the client","risk":"medium"},{"match_type":"Prospective Client / Intake","name":"Diana Kerubo","detail":"contact submission","risk":"low"}]', 'medium',
     'pending', v_admin, NOW() - INTERVAL '3 days');

  -- ============================================================
  -- INVOICES (created first so time entries can reference them)
  -- ============================================================
  -- Paid this month (M6): shows in "Collected this month"
  INSERT INTO invoices (invoice_number, matter_id, client_name, status, items, subtotal, vat_rate, vat_amount, total, issued_at, due_date, paid_at, created_by, created_at)
  VALUES ('INV-2026-9001', m6, 'Baraza Community Organisation', 'paid',
    '[{"description":"Drafting PBO constitution and registration forms (3h @ 10000/hr)","amount":30000},{"description":"Registry filings and follow-up (1h 30m @ 10000/hr)","amount":15000}]',
    45000, 16, 7200, 52200,
    NOW() - INTERVAL '20 days', (NOW() - INTERVAL '6 days')::date, NOW() - INTERVAL '4 days', v_admin, NOW() - INTERVAL '20 days')
  RETURNING id INTO inv_paid;

  -- Sent and OVERDUE (M3): triggers the overdue attention item
  INSERT INTO invoices (invoice_number, matter_id, client_name, client_kra_pin, status, items, subtotal, vat_rate, vat_amount, total, issued_at, due_date, created_by, created_at)
  VALUES ('INV-2026-9002', m3, 'Nyota Ventures Ltd (Nathan Otieno)', 'P051234567X', 'sent',
    '[{"description":"Engagement fee, company name change, CR12 and board resolutions","amount":28000}]',
    28000, 16, 4480, 32480,
    NOW() - INTERVAL '30 days', (NOW() - INTERVAL '14 days')::date, v_admin, NOW() - INTERVAL '30 days')
  RETURNING id INTO inv_overdue;

  -- Sent, not yet due (M1): outstanding receivable
  INSERT INTO invoices (invoice_number, matter_id, client_name, status, items, subtotal, vat_rate, vat_amount, total, issued_at, due_date, created_by, created_at)
  VALUES ('INV-2026-9003', m1, 'Kerry Kariuki', 'sent',
    '[{"description":"Initial succession filings, petition and gazettement (2h @ 8000/hr)","amount":16000},{"description":"Family consent documentation (1h @ 8000/hr)","amount":8000}]',
    24000, 16, 3840, 27840,
    NOW() - INTERVAL '8 days', (NOW() + INTERVAL '6 days')::date, v_admin, NOW() - INTERVAL '8 days')
  RETURNING id INTO inv_sent;

  -- Draft (M5): editable, releasable
  INSERT INTO invoices (invoice_number, matter_id, client_name, status, items, subtotal, vat_rate, vat_amount, total, created_by, created_at)
  VALUES ('INV-2026-9004', m5, 'Grace Wanjiru', 'draft',
    '[{"description":"Drafting and filing plaint (2h 30m @ 6000/hr)","amount":15000},{"description":"Court attendance, mention (2h @ 6000/hr)","amount":12000}]',
    27000, 16, 4320, 31320, v_admin, NOW() - INTERVAL '2 days')
  RETURNING id INTO inv_draft;

  -- ============================================================
  -- TIME ENTRIES, billed (linked to invoices) and unbilled
  -- ============================================================
  -- M1 billed (on INV-2026-9003)
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, invoice_id, created_at) VALUES
    (m1, v_admin, 'Initial succession filings, petition and gazettement', (NOW() - INTERVAL '12 days')::date, 120, 8000, true, inv_sent, NOW() - INTERVAL '12 days'),
    (m1, v_admin, 'Family consent documentation', (NOW() - INTERVAL '10 days')::date, 60, 8000, true, inv_sent, NOW() - INTERVAL '10 days');
  -- M1 unbilled (ready for the next invoice)
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, created_at) VALUES
    (m1, v_admin, 'Review of bank records and asset schedule', (NOW() - INTERVAL '4 days')::date, 90, 12000, true, NOW() - INTERVAL '4 days'),
    (m1, v_admin, 'Call with co-administrators on distribution proposal', (NOW() - INTERVAL '2 days')::date, 45, 12000, true, NOW() - INTERVAL '2 days'),
    (m1, v_admin, 'Drafting summons for confirmation of grant', (NOW() - INTERVAL '2 days')::date, 120, 8000, true, NOW() - INTERVAL '2 days');
  -- M2 unbilled
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, created_at) VALUES
    (m2, v_admin, 'First-pass review of lease, rent escalation and repair covenants', (NOW() - INTERVAL '12 days')::date, 60, 8000, true, NOW() - INTERVAL '12 days'),
    (m2, v_admin, 'Markup memo to landlord''s advocates', (NOW() - INTERVAL '10 days')::date, 90, 8000, true, NOW() - INTERVAL '10 days');
  -- M5: two on the draft invoice, one unbilled, one non-billable
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, invoice_id, created_at) VALUES
    (m5, v_admin, 'Drafting and filing plaint', (NOW() - INTERVAL '8 days')::date, 150, 6000, true, inv_draft, NOW() - INTERVAL '8 days'),
    (m5, v_admin, 'Court attendance, mention', (NOW() - INTERVAL '5 days')::date, 120, 6000, true, inv_draft, NOW() - INTERVAL '5 days');
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, created_at) VALUES
    (m5, v_admin, 'Preparing witness statement outline', (NOW() - INTERVAL '1 day')::date, 60, 6000, true, NOW() - INTERVAL '1 day'),
    (m5, v_admin, 'Internal strategy discussion (non-billable)', (NOW() - INTERVAL '1 day')::date, 30, 0, false, NOW() - INTERVAL '1 day');
  -- M6 billed (on the paid invoice)
  INSERT INTO time_entries (matter_id, profile_id, description, entry_date, minutes, rate, billable, invoice_id, created_at) VALUES
    (m6, v_admin, 'Drafting PBO constitution and registration forms', (NOW() - INTERVAL '30 days')::date, 180, 10000, true, inv_paid, NOW() - INTERVAL '30 days'),
    (m6, v_admin, 'Registry filings and follow-up', (NOW() - INTERVAL '25 days')::date, 90, 10000, true, inv_paid, NOW() - INTERVAL '25 days');

  -- ============================================================
  -- NEWSLETTER SUBSCRIBERS (your real emails + a few extras)
  -- ============================================================
  INSERT INTO mail_subscribers (email, name, tags) VALUES
    ('decrakerry@gmail.com', 'Kerry Kariuki', '{client}'),
    ('evanyam@gmail.com', 'Evans Nyamweya', '{client}'),
    ('decrakerubo2001@gmail.com', 'Diana Kerubo', '{client}'),
    ('entr.legal.partner@gmail.com', 'Nathan Otieno', '{client,corporate}'),
    ('grace.wanjiru@example.com', 'Grace Wanjiru', '{prospect}'),
    ('baraka.ochieng@example.com', 'Baraka Ochieng', '{prospect}'),
    ('newsletter.fan@example.com', 'Amos Kiprotich', '{}')
  ON CONFLICT (email) DO NOTHING;

END $$;
