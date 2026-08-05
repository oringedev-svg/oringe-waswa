-- ============================================================
-- 057 — Pupillage Pipeline
--
-- End-to-end pupillage intake: application → deed → documents
-- → signatures → KSL submission → onboarding → work book.
--
-- Source: KSL Pupillage Guidelines (Oct 2023), Pupillage
-- Particulars Form (Parts A-E), Pupillage Deed Template (Form C).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Pupil Master registry (extends team_members)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupil_masters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE UNIQUE,
  lsk_membership_no   TEXT NOT NULL,
  year_of_admission   INT  NOT NULL,
  years_of_practice   INT  NOT NULL,
  current_pc_no       TEXT,
  pc_valid_to         DATE,
  pc_evidence_urls    TEXT[] DEFAULT '{}',
  max_pupils          INT  NOT NULL DEFAULT 2,
  ksl_authorization_url TEXT,
  practice_areas_offered TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. Pupillage Centre (firm-level, one row per firm)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_centres (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE UNIQUE,
  firm_name     TEXT NOT NULL,
  postal_address  TEXT,
  physical_address TEXT,
  centre_category TEXT DEFAULT 'law_firm'
    CHECK (centre_category IN ('law_firm','government','ngo','corporate','other')),
  accreditation_ref TEXT,
  designated_supervisor_id UUID REFERENCES team_members(id),
  supervisor_phone TEXT,
  supervisor_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 3. Pupillage Applications (central workflow entity)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'submitted',
      'eligibility_check',
      'particulars_review',
      'deed_generated',
      'documents_pending',
      'ready_for_signature',
      'deed_executed',
      'submitted_to_ksl',
      'approved',
      'active',
      'completed',
      'terminated',
      'rejected'
    )),

  -- Links
  pupil_profile_id   UUID NOT NULL REFERENCES profiles(id),
  pupil_master_id    UUID NOT NULL REFERENCES pupil_masters(id),
  centre_id          UUID REFERENCES pupillage_centres(id),

  -- Part A: Pupil details (captured once at application)
  pupil_full_name          TEXT NOT NULL,
  pupil_id_number          TEXT,
  pupil_passport_number    TEXT,
  pupil_dob                DATE,
  pupil_gender             TEXT CHECK (pupil_gender IN ('male','female','other')),
  pupil_phone              TEXT,
  pupil_email              TEXT,
  pupil_postal_address     TEXT,
  pupil_ksl_admission_no   TEXT,
  pupil_atp_intake         TEXT,
  pupil_university         TEXT,
  pupil_llb_completion_date DATE,
  pupil_kra_pin            TEXT,
  pupil_bank_name          TEXT,
  pupil_bank_branch        TEXT,
  pupil_bank_account       TEXT,
  pupil_mobile_money_no    TEXT,
  pupil_next_of_kin_name   TEXT,
  pupil_next_of_kin_phone  TEXT,
  pupil_next_of_kin_relationship TEXT,
  pupil_special_needs      BOOLEAN DEFAULT FALSE,
  pupil_special_needs_notes TEXT,

  -- Part D: Term & Facilitation
  term_start_date    DATE,
  term_end_date      DATE,
  monthly_stipend    DECIMAL(12,2),
  stipend_payment_day INT CHECK (stipend_payment_day IS NULL OR stipend_payment_day BETWEEN 1 AND 31),
  other_facilities   TEXT,

  -- Schedule 1: Practice area rotations
  -- [{area, duration_months, order}]
  practice_rotations JSONB DEFAULT '[]',

  -- Tracking timestamps
  submitted_at          TIMESTAMPTZ,
  eligibility_checked_at TIMESTAMPTZ,
  eligibility_result     JSONB,
  deed_generated_at      TIMESTAMPTZ,
  deed_file_url          TEXT,
  deed_file_name         TEXT,
  signed_at              TIMESTAMPTZ,
  submitted_to_ksl_at    TIMESTAMPTZ,
  ksl_reference          TEXT,
  approved_at            TIMESTAMPTZ,
  onboarded_at           TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  terminated_at          TIMESTAMPTZ,
  termination_reason     TEXT,

  -- Signatures
  pupil_signature_url    TEXT,
  pupil_signed_at        TIMESTAMPTZ,
  master_signature_url   TEXT,
  master_signed_at       TIMESTAMPTZ,
  witness_name           TEXT,
  witness_signature_url  TEXT,
  witness_signed_at      TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. Document Checklist (Part E / Guidelines §4.0)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_checklist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES pupillage_applications(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL CHECK (document_type IN (
    'signed_deed',
    'pm_current_pc',
    'pm_5yr_pcs',
    's10_exemption',
    'registration_form_d',
    'pupil_id_copy',
    'pupil_academic_docs',
    'pupil_kra_bank'
  )),
  is_required      BOOLEAN NOT NULL DEFAULT TRUE,
  is_applicable    BOOLEAN NOT NULL DEFAULT TRUE,
  file_url         TEXT,
  file_name        TEXT,
  auto_satisfied        BOOLEAN DEFAULT FALSE,
  auto_satisfied_source TEXT,
  uploaded_at      TIMESTAMPTZ,
  verified_by      UUID REFERENCES profiles(id),
  verified_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','uploaded','verified','rejected','not_applicable')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (application_id, document_type)
);

-- ────────────────────────────────────────────────────────────
-- 5. Work Book Entries (daily log, monthly sign-off)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_workbook_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES pupillage_applications(id) ON DELETE CASCADE,
  entry_date     DATE NOT NULL,
  description    TEXT NOT NULL,
  practice_area  TEXT,
  hours_spent    DECIMAL(4,1),
  supervisor_signed_off BOOLEAN DEFAULT FALSE,
  supervisor_signed_at  TIMESTAMPTZ,
  supervisor_notes      TEXT,
  is_locked      BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (application_id, entry_date)
);

-- ────────────────────────────────────────────────────────────
-- 6. Malpractice Flags (Guidelines §9.0, ready for v2)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_malpractice_flags (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES pupillage_applications(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  description    TEXT NOT NULL,
  raised_by      UUID REFERENCES profiles(id),
  raised_at      TIMESTAMPTZ DEFAULT NOW(),
  hearing_status TEXT DEFAULT 'pending'
    CHECK (hearing_status IN ('pending','under_review','hearing_scheduled','resolved','dismissed')),
  resolution_notes TEXT,
  resolved_at      TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- 7. Compliance Reports (end-of-term, para. 3.6)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_compliance_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES pupillage_applications(id) ON DELETE CASCADE UNIQUE,
  due_date       DATE NOT NULL,
  sealed_report_url        TEXT,
  sealed_report_uploaded_at TIMESTAMPTZ,
  completion_cert_url       TEXT,
  completion_cert_issued_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','report_submitted','cert_issued','completed','overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 8. Audit trail / Events
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pupillage_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES pupillage_applications(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  detail         TEXT,
  actor_id       UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_pupillage_apps_status       ON pupillage_applications(status);
CREATE INDEX idx_pupillage_apps_pupil        ON pupillage_applications(pupil_profile_id);
CREATE INDEX idx_pupillage_apps_master       ON pupillage_applications(pupil_master_id);
CREATE INDEX idx_pupillage_checklist_app     ON pupillage_checklist_items(application_id);
CREATE INDEX idx_pupillage_workbook_app_date ON pupillage_workbook_entries(application_id, entry_date);
CREATE INDEX idx_pupillage_events_app        ON pupillage_events(application_id);
CREATE INDEX idx_pupil_masters_team          ON pupil_masters(team_member_id);
