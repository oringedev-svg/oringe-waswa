-- ============================================================
-- ORGANIZATION & WORKFORCE ENGINE
-- ============================================================
-- A firm's hierarchy is never hardcoded: organizational categories,
-- professional types (professions, not titles), and positions (rank) are
-- all firm-editable tables seeded with a complete legal-industry taxonomy,
-- not a fixed enum. Eligibility (position_professional_types) prevents
-- impossible assignments (a Paralegal can't hold a Managing Partner
-- position). Legal authorities (Advocate, Commissioner for Oaths, ...) are
-- independent of position, a person may hold several. Existing
-- team_members.position/department/seniority columns are left untouched,
-- this is additive so nothing currently working breaks.

-- ============================================================
-- LEVEL 1, organizational structure. Replaces the hardcoded
-- DEPARTMENTS array previously used on the team admin page.
-- ============================================================
CREATE TABLE org_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEVEL 2, professional types (professions, not titles).
-- ============================================================
CREATE TABLE professional_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_category_id UUID REFERENCES org_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_professional_types_category ON professional_types(org_category_id);

-- ============================================================
-- LEVEL 3, positions (rank). maps_to_role plugs into the EXISTING
-- permissions system (profiles.role / src/lib/permissions.ts) rather than
-- a new parallel permission-set system.
-- ============================================================
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  hierarchy_level INT DEFAULT 0,
  reports_to_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
  can_supervise BOOLEAN DEFAULT false,
  approval_level INT DEFAULT 0,
  can_sign_documents BOOLEAN DEFAULT false,
  can_approve_bills BOOLEAN DEFAULT false,
  can_assign_matters BOOLEAN DEFAULT false,
  maps_to_role TEXT CHECK (maps_to_role IN ('admin','staff','moderator','client','volunteer','public','pupil','admin_assistant')),
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eligibility: which professional types may hold a given position, this
-- is the mechanism that prevents impossible assignments.
CREATE TABLE position_professional_types (
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE NOT NULL,
  professional_type_id UUID REFERENCES professional_types(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (position_id, professional_type_id)
);

-- ============================================================
-- LEGAL AUTHORITIES, independent of position, a person may hold several.
-- ============================================================
CREATE TABLE legal_authorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_member_authorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  authority_id UUID REFERENCES legal_authorities(id) ON DELETE CASCADE NOT NULL,
  issuing_body TEXT,
  reference_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','pending')),
  certificate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_team_member_authorities_member ON team_member_authorities(team_member_id);

-- ============================================================
-- PROFESSIONAL PROFILE, industries, skills, practice areas (many-to-many).
-- Practice areas reuse the EXISTING practice_areas table
-- (009_practice_areas_testimonials.sql), not a duplicate taxonomy.
-- ============================================================
CREATE TABLE industries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ
);

CREATE TABLE team_member_industries (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  industry_id UUID REFERENCES industries(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (team_member_id, industry_id)
);

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ
);

CREATE TABLE team_member_skills (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  level TEXT CHECK (level IN ('beginner','intermediate','advanced','expert')),
  verified BOOLEAN DEFAULT false,
  years NUMERIC,
  last_used DATE,
  PRIMARY KEY (team_member_id, skill_id)
);

CREATE TABLE team_member_practice_areas (
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  practice_area_id UUID REFERENCES practice_areas(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (team_member_id, practice_area_id)
);

-- ============================================================
-- DOCUMENT ENGINE, required documents per professional type, and the
-- per-person compliance record. status/expiry are rendered as a derived
-- urgency badge (see src/lib/workforce.ts), not a trigger for any
-- notification system, no email/push infra exists in this codebase.
-- ============================================================
CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  visible BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ
);

CREATE TABLE professional_type_required_documents (
  professional_type_id UUID REFERENCES professional_types(id) ON DELETE CASCADE NOT NULL,
  document_type_id UUID REFERENCES document_types(id) ON DELETE CASCADE NOT NULL,
  is_required BOOLEAN DEFAULT true,
  PRIMARY KEY (professional_type_id, document_type_id)
);

CREATE TABLE team_member_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  document_type_id UUID REFERENCES document_types(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'required' CHECK (status IN (
    'not_required','required','pending','uploaded','under_review','approved','rejected','expired','renewal_due'
  )),
  issue_date DATE,
  expiry_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_team_member_documents_member ON team_member_documents(team_member_id);

ALTER TABLE org_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_professional_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_type_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_documents ENABLE ROW LEVEL SECURITY;
-- No policies, API-only via the service-role client, same convention
-- as the rest of the schema.

-- ============================================================
-- New personal/employment fields on team_members. Additive only, the
-- existing position/department/seniority columns are untouched.
-- ============================================================
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS organizational_category_id UUID REFERENCES org_categories(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS professional_type_id UUID REFERENCES professional_types(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS reports_to_id UUID REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS kra_pin TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS nssf_number TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS sha_number TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time','part_time','contract','consultant','retainer'));
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','suspended','terminated','alumni'));
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS exit_date DATE;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_organization', 'Manage Organization Structure', 'Staff', 'Configure organizational categories, professional types, positions, and legal authorities')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DATA
-- ============================================================

-- LEVEL 1: organizational categories
INSERT INTO org_categories (name, sort_order, is_system_default) VALUES
  ('Legal Services', 1, true),
  ('Business Services', 2, true),
  ('Technology', 3, true),
  ('Finance', 4, true),
  ('Human Resources', 5, true),
  ('Administration', 6, true),
  ('Compliance & Risk', 7, true),
  ('Knowledge Management', 8, true),
  ('Operations', 9, true),
  ('Marketing & Business Development', 10, true),
  ('Client Services', 11, true),
  ('External Professionals', 12, true);

-- LEVEL 2 + LEVEL 3 + eligibility + authorities + industries + skills +
-- document types, all in one block since positions/eligibility need to
-- reference professional_types by id, and professional_types need to
-- reference org_categories by id.
DO $$
DECLARE
  cat_legal UUID; cat_tech UUID; cat_finance UUID; cat_hr UUID; cat_admin UUID;
  cat_bizdev UUID; cat_compliance UUID; cat_external UUID;

  pt_advocate UUID; pt_pupil UUID; pt_legal_intern UUID; pt_legal_researcher UUID;
  pt_consultant UUID;

  pos_managing_partner UUID; pos_senior_partner UUID; pos_partner UUID;
  pos_equity_partner UUID; pos_salaried_partner UUID; pos_founding_partner UUID;
  pos_practice_group_head UUID; pos_principal_associate UUID; pos_senior_associate UUID;
  pos_associate UUID; pos_junior_associate UUID; pos_head_of_department UUID;
  pos_manager UUID; pos_team_lead UUID; pos_officer UUID; pos_assistant UUID;
  pos_coordinator UUID; pos_administrator UUID; pos_executive UUID;
  pos_intern UUID; pos_pupil UUID;

  dt_practising_cert UUID; dt_lsk UUID; dt_admission_cert UUID; dt_national_id UUID;
  dt_kra_pin UUID; dt_cv UUID; dt_employment_contract UUID; dt_pupil_agreement UUID;
  dt_llb UUID; dt_ksl UUID; dt_internship_agreement UUID; dt_student_id UUID;
  dt_recommendation_letter UUID; dt_consultancy_agreement UUID; dt_nda UUID;
BEGIN
  SELECT id INTO cat_legal FROM org_categories WHERE name = 'Legal Services';
  SELECT id INTO cat_tech FROM org_categories WHERE name = 'Technology';
  SELECT id INTO cat_finance FROM org_categories WHERE name = 'Finance';
  SELECT id INTO cat_hr FROM org_categories WHERE name = 'Human Resources';
  SELECT id INTO cat_admin FROM org_categories WHERE name = 'Administration';
  SELECT id INTO cat_bizdev FROM org_categories WHERE name = 'Marketing & Business Development';
  SELECT id INTO cat_compliance FROM org_categories WHERE name = 'Compliance & Risk';
  SELECT id INTO cat_external FROM org_categories WHERE name = 'External Professionals';

  -- LEVEL 2: professional types
  INSERT INTO professional_types (org_category_id, name, sort_order, is_system_default) VALUES
    (cat_legal, 'Advocate', 1, true),
    (cat_legal, 'Pupil', 2, true),
    (cat_legal, 'Legal Intern', 3, true),
    (cat_legal, 'Legal Researcher', 4, true),
    (cat_legal, 'Paralegal', 5, true),
    (cat_legal, 'Company Secretary', 6, true),
    (cat_legal, 'Foreign Legal Consultant', 7, true),
    (cat_legal, 'Legal Consultant', 8, true),
    (cat_legal, 'Consultant Advocate', 9, true),
    (cat_legal, 'Contract Advocate', 10, true),
    (cat_tech, 'Software Engineer', 1, true),
    (cat_tech, 'AI Engineer', 2, true),
    (cat_tech, 'Machine Learning Engineer', 3, true),
    (cat_tech, 'DevOps Engineer', 4, true),
    (cat_tech, 'Cloud Engineer', 5, true),
    (cat_tech, 'Systems Administrator', 6, true),
    (cat_tech, 'IT Support', 7, true),
    (cat_tech, 'UX Designer', 8, true),
    (cat_tech, 'UI Designer', 9, true),
    (cat_tech, 'QA Engineer', 10, true),
    (cat_tech, 'Product Manager', 11, true),
    (cat_tech, 'Business Analyst', 12, true),
    (cat_tech, 'Data Engineer', 13, true),
    (cat_finance, 'Accountant', 1, true),
    (cat_finance, 'Finance Officer', 2, true),
    (cat_finance, 'Billing Officer', 3, true),
    (cat_finance, 'Credit Controller', 4, true),
    (cat_finance, 'Cashier', 5, true),
    (cat_finance, 'Auditor', 6, true),
    (cat_hr, 'HR Manager', 1, true),
    (cat_hr, 'HR Officer', 2, true),
    (cat_hr, 'Recruitment Officer', 3, true),
    (cat_hr, 'Learning & Development Officer', 4, true),
    (cat_admin, 'Office Administrator', 1, true),
    (cat_admin, 'Executive Assistant', 2, true),
    (cat_admin, 'Secretary', 3, true),
    (cat_admin, 'Receptionist', 4, true),
    (cat_admin, 'Records Officer', 5, true),
    (cat_admin, 'Office Assistant', 6, true),
    (cat_admin, 'Messenger', 7, true),
    (cat_bizdev, 'Business Development Manager', 1, true),
    (cat_bizdev, 'Marketing Manager', 2, true),
    (cat_bizdev, 'CRM Officer', 3, true),
    (cat_bizdev, 'Communications Officer', 4, true),
    (cat_bizdev, 'Events Coordinator', 5, true),
    (cat_compliance, 'Compliance Officer', 1, true),
    (cat_compliance, 'Risk Officer', 2, true),
    (cat_compliance, 'Data Protection Officer', 3, true),
    (cat_compliance, 'AML Officer', 4, true),
    (cat_compliance, 'Internal Auditor', 5, true),
    (cat_external, 'Consultant', 1, true),
    (cat_external, 'External Counsel', 2, true),
    (cat_external, 'Process Server', 3, true),
    (cat_external, 'Court Clerk', 4, true),
    (cat_external, 'Translator', 5, true),
    (cat_external, 'Expert Witness', 6, true),
    (cat_external, 'Valuer', 7, true),
    (cat_external, 'Surveyor', 8, true),
    (cat_external, 'Investigator', 9, true),
    (cat_external, 'Forensic Expert', 10, true);

  SELECT id INTO pt_advocate FROM professional_types WHERE name = 'Advocate';
  SELECT id INTO pt_pupil FROM professional_types WHERE name = 'Pupil';
  SELECT id INTO pt_legal_intern FROM professional_types WHERE name = 'Legal Intern';
  SELECT id INTO pt_legal_researcher FROM professional_types WHERE name = 'Legal Researcher';
  SELECT id INTO pt_consultant FROM professional_types WHERE name = 'Consultant';

  -- LEVEL 3: positions
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Founding Partner', 100, true, 5, true, true, true, 'staff', 1, true) RETURNING id INTO pos_founding_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Managing Partner', 99, true, 5, true, true, true, 'staff', 2, true) RETURNING id INTO pos_managing_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Senior Partner', 95, true, 5, true, true, true, 'staff', 3, true) RETURNING id INTO pos_senior_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Equity Partner', 90, true, 4, true, true, true, 'staff', 4, true) RETURNING id INTO pos_equity_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Partner', 88, true, 4, true, true, true, 'staff', 5, true) RETURNING id INTO pos_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Salaried Partner', 85, true, 3, true, false, true, 'staff', 6, true) RETURNING id INTO pos_salaried_partner;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Practice Group Head', 82, true, 4, true, false, true, 'staff', 7, true) RETURNING id INTO pos_practice_group_head;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Principal Associate', 70, true, 2, false, false, true, 'staff', 8, true) RETURNING id INTO pos_principal_associate;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Senior Associate', 60, true, 2, false, false, false, 'staff', 9, true) RETURNING id INTO pos_senior_associate;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Associate', 50, false, 1, false, false, false, 'staff', 10, true) RETURNING id INTO pos_associate;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Junior Associate', 40, false, 0, false, false, false, 'staff', 11, true) RETURNING id INTO pos_junior_associate;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Head of Department', 80, true, 3, true, true, true, 'staff', 12, true) RETURNING id INTO pos_head_of_department;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Manager', 65, true, 2, false, false, false, 'staff', 13, true) RETURNING id INTO pos_manager;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Team Lead', 55, true, 1, false, false, false, 'staff', 14, true) RETURNING id INTO pos_team_lead;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Officer', 40, false, 0, false, false, false, 'staff', 15, true) RETURNING id INTO pos_officer;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Assistant', 30, false, 0, false, false, false, 'admin_assistant', 16, true) RETURNING id INTO pos_assistant;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Coordinator', 35, false, 0, false, false, false, 'staff', 17, true) RETURNING id INTO pos_coordinator;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Administrator', 30, false, 0, false, false, false, 'admin_assistant', 18, true) RETURNING id INTO pos_administrator;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Executive', 45, false, 1, false, false, false, 'staff', 19, true) RETURNING id INTO pos_executive;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Intern', 10, false, 0, false, false, false, 'staff', 20, true) RETURNING id INTO pos_intern;
  INSERT INTO positions (name, hierarchy_level, can_supervise, approval_level, can_sign_documents, can_approve_bills, can_assign_matters, maps_to_role, sort_order, is_system_default) VALUES
    ('Pupil', 15, false, 0, false, false, false, 'pupil', 21, true) RETURNING id INTO pos_pupil;

  -- Reporting lines (a structural default, not a per-person assignment).
  UPDATE positions SET reports_to_position_id = pos_founding_partner WHERE id IN (pos_managing_partner);
  UPDATE positions SET reports_to_position_id = pos_managing_partner WHERE id IN (pos_senior_partner, pos_equity_partner, pos_practice_group_head, pos_head_of_department);
  UPDATE positions SET reports_to_position_id = pos_senior_partner WHERE id IN (pos_partner);
  UPDATE positions SET reports_to_position_id = pos_partner WHERE id IN (pos_salaried_partner, pos_principal_associate);
  UPDATE positions SET reports_to_position_id = pos_principal_associate WHERE id IN (pos_senior_associate, pos_pupil);
  UPDATE positions SET reports_to_position_id = pos_senior_associate WHERE id IN (pos_associate);
  UPDATE positions SET reports_to_position_id = pos_associate WHERE id IN (pos_junior_associate, pos_intern);
  UPDATE positions SET reports_to_position_id = pos_head_of_department WHERE id IN (pos_manager);
  UPDATE positions SET reports_to_position_id = pos_manager WHERE id IN (pos_team_lead, pos_coordinator, pos_administrator, pos_executive);
  UPDATE positions SET reports_to_position_id = pos_team_lead WHERE id IN (pos_officer, pos_assistant);

  -- Eligibility: legal-track positions accept only Advocate (except Pupil
  -- and Intern positions, which have their own matching professional type).
  INSERT INTO position_professional_types (position_id, professional_type_id)
  SELECT p.id, pt_advocate FROM positions p
  WHERE p.id IN (pos_founding_partner, pos_managing_partner, pos_senior_partner, pos_equity_partner,
    pos_partner, pos_salaried_partner, pos_practice_group_head, pos_principal_associate,
    pos_senior_associate, pos_associate, pos_junior_associate, pos_head_of_department);

  INSERT INTO position_professional_types (position_id, professional_type_id) VALUES
    (pos_pupil, pt_pupil),
    (pos_intern, pt_legal_intern),
    (pos_intern, pt_legal_researcher);

  -- Cross-functional positions accept any non-legal, non-external
  -- professional type (e.g. "Finance Manager" = Manager position +
  -- Accountant professional type).
  INSERT INTO position_professional_types (position_id, professional_type_id)
  SELECT p.id, pt.id FROM positions p, professional_types pt
  JOIN org_categories oc ON pt.org_category_id = oc.id
  WHERE p.id IN (pos_head_of_department, pos_manager, pos_team_lead, pos_officer, pos_assistant, pos_coordinator, pos_administrator, pos_executive)
  AND oc.name IN ('Technology', 'Finance', 'Human Resources', 'Administration', 'Marketing & Business Development', 'Compliance & Risk');

  -- External professionals only ever hold External-category professional
  -- types, matched loosely via the Consultant/Officer/Administrator
  -- generic positions, since external professionals sit outside the firm's
  -- own reporting line.
  INSERT INTO position_professional_types (position_id, professional_type_id)
  SELECT pos_officer, pt.id FROM professional_types pt
  JOIN org_categories oc ON pt.org_category_id = oc.id
  WHERE oc.name = 'External Professionals';

  -- LEGAL AUTHORITIES
  INSERT INTO legal_authorities (name, sort_order, is_system_default) VALUES
    ('Advocate', 1, true),
    ('Commissioner for Oaths', 2, true),
    ('Notary Public', 3, true),
    ('Mediator', 4, true),
    ('Arbitrator', 5, true),
    ('Certified Secretary', 6, true),
    ('Trademark Agent', 7, true),
    ('Patent Agent', 8, true),
    ('Tax Agent', 9, true),
    ('Data Protection Officer', 10, true),
    ('Insolvency Practitioner', 11, true);

  -- INDUSTRIES
  INSERT INTO industries (name, sort_order, is_system_default) VALUES
    ('Banking', 1, true), ('Insurance', 2, true), ('Healthcare', 3, true),
    ('Telecommunications', 4, true), ('Government', 5, true), ('NGO', 6, true),
    ('Manufacturing', 7, true), ('Construction', 8, true), ('Mining', 9, true),
    ('Agriculture', 10, true), ('AI', 11, true), ('FinTech', 12, true),
    ('ClimateTech', 13, true), ('Energy', 14, true), ('Media', 15, true),
    ('Education', 16, true);

  -- SKILLS
  INSERT INTO skills (name, sort_order, is_system_default) VALUES
    ('Negotiation', 1, true), ('Advocacy', 2, true), ('Research', 3, true),
    ('Drafting', 4, true), ('Mediation', 5, true), ('Due Diligence', 6, true),
    ('AI Governance', 7, true), ('Cybersecurity', 8, true), ('Privacy', 9, true),
    ('Product Law', 10, true), ('M&A', 11, true), ('Contract Review', 12, true);

  -- DOCUMENT TYPES
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Practising Certificate', 1, true) RETURNING id INTO dt_practising_cert;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('LSK Membership', 2, true) RETURNING id INTO dt_lsk;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Admission Certificate', 3, true) RETURNING id INTO dt_admission_cert;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('National ID', 4, true) RETURNING id INTO dt_national_id;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('KRA PIN Certificate', 5, true) RETURNING id INTO dt_kra_pin;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Curriculum Vitae', 6, true) RETURNING id INTO dt_cv;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Employment Contract', 7, true) RETURNING id INTO dt_employment_contract;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Pupil Agreement', 8, true) RETURNING id INTO dt_pupil_agreement;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('LLB Certificate', 9, true) RETURNING id INTO dt_llb;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('KSL Admission', 10, true) RETURNING id INTO dt_ksl;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Internship Agreement', 11, true) RETURNING id INTO dt_internship_agreement;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Student ID', 12, true) RETURNING id INTO dt_student_id;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Recommendation Letter', 13, true) RETURNING id INTO dt_recommendation_letter;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('Consultancy Agreement', 14, true) RETURNING id INTO dt_consultancy_agreement;
  INSERT INTO document_types (name, sort_order, is_system_default) VALUES
    ('NDA', 15, true) RETURNING id INTO dt_nda;

  -- Required documents per professional type.
  INSERT INTO professional_type_required_documents (professional_type_id, document_type_id) VALUES
    (pt_advocate, dt_practising_cert), (pt_advocate, dt_lsk), (pt_advocate, dt_admission_cert),
    (pt_advocate, dt_national_id), (pt_advocate, dt_kra_pin), (pt_advocate, dt_employment_contract), (pt_advocate, dt_cv),
    (pt_pupil, dt_pupil_agreement), (pt_pupil, dt_llb), (pt_pupil, dt_ksl), (pt_pupil, dt_national_id), (pt_pupil, dt_cv),
    (pt_legal_intern, dt_internship_agreement), (pt_legal_intern, dt_student_id), (pt_legal_intern, dt_recommendation_letter), (pt_legal_intern, dt_cv),
    (pt_consultant, dt_consultancy_agreement), (pt_consultant, dt_nda);
END $$;
