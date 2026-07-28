-- ============================================================
-- LEGAL KNOWLEDGE BASE: problem -> solution suggestions, court
-- routing, and location-driven service-of-process deadlines
-- ============================================================
-- Pragmatic subset of a much larger "decision graph" the firm sketched:
-- a real relational problem/solution library with search, a court-routing
-- rule table seeded from the firm's own court-jurisdiction reference, and
-- a fully-specified service-of-process tracker. Wired into the existing
-- matter and submission pages rather than shipped as a disconnected tool.

-- Reference library: one row per identifiable legal problem.
CREATE TABLE problem_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,        -- 'Contract','Employment','Land','Family', etc, a filter facet
  matter_type TEXT,              -- soft link to the MATTER_TYPES value (src/lib/utils.ts), used to auto-match suggestions
  title TEXT NOT NULL,
  description TEXT,
  keywords TEXT[] DEFAULT '{}',
  typical_client TEXT,           -- 'Business','Employee','Individual', display only
  limitation_period TEXT,        -- '6 years', free text, display only, not computed
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ranked, prerequisite-gated remedies for a problem.
CREATE TABLE problem_solutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id UUID REFERENCES problem_types(id) ON DELETE CASCADE NOT NULL,
  priority INT NOT NULL DEFAULT 1,      -- 1 = try first, ascending order of escalation
  solution TEXT NOT NULL,               -- 'Demand Letter'
  prerequisite TEXT,                    -- human-readable, not boolean-evaluated
  is_court_track BOOLEAN DEFAULT false, -- true once the remedy means filing in court
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_problem_solutions_problem ON problem_solutions(problem_id);

-- Court/registry routing, seeded from the firm's own court-jurisdiction table.
CREATE TABLE court_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,        -- routing key, see src/lib/courtRouting.ts
  label TEXT NOT NULL,           -- 'Simple Commercial/Civil Dispute'
  min_value NUMERIC,
  max_value NUMERIC,             -- null = no upper bound
  court_name TEXT NOT NULL,
  registry_notes TEXT,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service-of-process tracking: one row per party served, per attempt.
CREATE TABLE service_of_process (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL,
  document_description TEXT,      -- free-text fallback if the served document isn't uploaded yet
  recipient_name TEXT NOT NULL,
  recipient_role TEXT,            -- 'Defendant','Respondent', free text
  location_tier TEXT NOT NULL CHECK (location_tier IN ('within_town','outside_town','outside_country')),
  method TEXT,                    -- 'Process server','Registered post','Email', free text
  served_at DATE NOT NULL,
  response_due_date DATE NOT NULL,  -- computed at insert time and stored, stable against later rule edits
  status TEXT NOT NULL DEFAULT 'awaiting_response' CHECK (status IN ('awaiting_response','responded','escalated')),
  response_note TEXT,
  responded_at TIMESTAMPTZ,
  task_id UUID REFERENCES matter_tasks(id) ON DELETE SET NULL,  -- the auto-created diary entry
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_of_process_matter ON service_of_process(matter_id);

ALTER TABLE problem_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_of_process ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.

ALTER TABLE legal_matters ADD COLUMN IF NOT EXISTS claim_value NUMERIC;
ALTER TABLE legal_matters ADD COLUMN IF NOT EXISTS county TEXT;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_legal_knowledge', 'Manage Legal Knowledge', 'Legal', 'Maintain the problem/solution library and court routing rules')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DATA
-- ============================================================
-- Court routing table, transcribed from the firm's own court-jurisdiction
-- reference. category keys mirror MATTER_TYPE_TO_COURT_CATEGORY in
-- src/lib/courtRouting.ts.

INSERT INTO court_routing_rules (category, label, min_value, max_value, court_name, registry_notes, display_order) VALUES
  ('civil_commercial', 'Simple Commercial/Civil Dispute (breach of contract, unpaid debts, recovery of goods, personal injury)', NULL, 1000000, 'Small Claims Court (SCC)', 'Filed online via e-filing. Physically located at Milimani Law Courts (Nairobi) or in major county headquarters (e.g. Mombasa, Kisumu, Nakuru, Eldoret).', 1),
  ('civil_commercial', 'Standard Civil/Commercial Dispute (contract breaches, debt recovery)', 1000000, 20000000, 'Magistrates'' Court', 'Over 127 stations countrywide (e.g. Milimani Commercial Courts for Nairobi civil disputes, or the local court where the cause of action arose).', 2),
  ('civil_commercial', 'High-Value Commercial/Civil Dispute', 20000000, NULL, 'High Court (Commercial & Tax or Civil Division)', 'Located in 41 out of 47 counties. In Nairobi, file at Milimani Law Courts, Upper Hill.', 3),
  ('land', 'Land & Boundary Disputes (title deed disputes, evictions, trespass, environmental damage)', NULL, NULL, 'Environment and Land Court (ELC)', 'Specialized court with High Court status. Located in major county High Court stations.', 4),
  ('employment', 'Employment / Labor Disputes (unfair termination, unpaid salary, trade union disputes)', NULL, NULL, 'Employment and Labour Relations Court (ELRC)', 'Specialized court with High Court status. Main registries are in Nairobi (Milimani), Mombasa, Kisumu, Nakuru, and Nyeri.', 5),
  ('family', 'Family Matters (divorce, child custody, probate/administration of estates)', NULL, NULL, 'Magistrates'' Court (low/mid estate values) or High Court (Family Division)', 'Filed at your nearest local Magistrates'' Court or the nearest High Court Family Registry.', 6),
  ('muslim_personal', 'Muslim Personal Law (marriage, divorce, inheritance where both parties are Muslims)', NULL, NULL, 'Kadhi''s Court', 'Located in designated regions with substantial Muslim populations (e.g. Nairobi, Mombasa, Garissa, Kisumu).', 7),
  ('criminal_minor', 'Criminal Offences, Minor to Serious (theft, assault, traffic offences)', NULL, NULL, 'Magistrates'' Court (Criminal Division)', 'Filed in the magistrate court within the geographical area where the crime was committed (e.g. Kibera, Makadara, or Milimani in Nairobi).', 8),
  ('criminal_capital', 'Capital Offences / Complex Crimes (murder, treason, high-level economic crimes)', NULL, NULL, 'High Court (Criminal or Anti-Corruption Division)', 'Headquartered at Milimani Law Courts (Nairobi) or the local High Court station in the county where the crime occurred.', 9),
  ('constitutional', 'Constitutional Violations (human rights abuses, challenging a law''s constitutionality)', NULL, NULL, 'High Court (Constitutional & Human Rights Division)', 'Any High Court Station registry across the country (Principal registry is at Milimani, Nairobi).', 10),
  ('appeal', 'Appeals from High Court / ELC / ELRC', NULL, NULL, 'Court of Appeal', 'Permanent benches are located in Nairobi, Mombasa, Kisumu, Nakuru, and Nyeri.', 11),
  ('election_petition', 'Presidential Election Petitions', NULL, NULL, 'Supreme Court of Kenya', 'Supreme Court Building, City Hall Way, Nairobi.', 12);

-- Problem & Solutions starter library. A starting template for the firm to
-- review and edit, not filed legal advice, mirrors the escalation pattern
-- (Negotiation -> Demand Letter -> Notice/ADR -> Mediation/Arbitration ->
-- Court Claim) sketched by the firm for breach of contract, applied across
-- the practice areas the site already lists.

DO $$
DECLARE
  p_id UUID;
BEGIN
  -- Breach of Contract
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Contract', 'civil_litigation', 'Breach of Contract', 'A party has failed to perform an obligation under a valid contract.', ARRAY['breach','contract','default','non-performance'], 'Business or Individual', '6 years', 1)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Negotiation', 'None, always the first, lowest-cost step.', false),
    (p_id, 2, 'Demand Letter', 'A valid contract exists and the breach can be evidenced.', false),
    (p_id, 3, 'Notice to Cure', 'The contract contains a cure period clause.', false),
    (p_id, 4, 'Mediation', 'The contract contains an ADR/mediation clause, or both parties agree to mediate.', false),
    (p_id, 5, 'Arbitration', 'The contract contains an arbitration clause.', false),
    (p_id, 6, 'Court Claim', 'Demand letter served, notice period expired, ADR exhausted where required, limitation period not expired.', true);

  -- Unpaid Debt / Recovery of Goods
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Contract', 'civil_litigation', 'Unpaid Debt / Recovery of Goods', 'A client is owed money or goods that have not been returned or paid for.', ARRAY['debt','recovery','unpaid','invoice'], 'Business', '6 years', 2)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Demand Letter', 'Debt amount is documented (invoice, receipt, agreement).', false),
    (p_id, 2, 'Statement of Account / Reconciliation', 'Debtor disputes the amount owed.', false),
    (p_id, 3, 'Negotiated Payment Plan', 'Debtor acknowledges the debt but disputes timing.', false),
    (p_id, 4, 'Small Claims / Court Claim', 'Demand letter served and reasonable time elapsed without payment.', true);

  -- Unfair / Wrongful Termination
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Employment', 'employment', 'Unfair / Wrongful Termination', 'An employee was dismissed without a fair reason or a fair process.', ARRAY['termination','dismissal','unfair','wrongful'], 'Employee', '3 years', 3)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Internal Grievance / Appeal', 'Employer has an internal grievance procedure.', false),
    (p_id, 2, 'Demand Letter to Employer', 'Termination letter or evidence of dismissal exists.', false),
    (p_id, 3, 'Referral to Labour Officer', 'Both parties are open to conciliation.', false),
    (p_id, 4, 'ELRC Claim', 'Internal remedies exhausted or employer non-responsive.', true);

  -- Unpaid Wages / Salary
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Employment', 'employment', 'Unpaid Wages / Salary', 'An employer has failed to pay wages, overtime, or terminal dues.', ARRAY['salary','wages','unpaid','terminal dues'], 'Employee', '3 years', 4)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Demand Letter', 'Payslips or employment contract evidencing the amount owed.', false),
    (p_id, 2, 'Referral to Labour Officer', 'Employer disputes the amount.', false),
    (p_id, 3, 'ELRC Claim', 'Demand unresolved after a reasonable period.', true);

  -- Land Trespass / Boundary Dispute
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Land', 'property', 'Land Trespass / Boundary Dispute', 'Unauthorised entry onto land, or a dispute over a boundary line.', ARRAY['trespass','boundary','land','encroachment'], 'Individual or Business', '12 years', 5)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Land Survey / Title Search', 'None, establishes the facts first.', false),
    (p_id, 2, 'Demand Letter / Notice to Vacate', 'Title deed or survey confirms the boundary.', false),
    (p_id, 3, 'Mediation via Land Registrar', 'Both parties are open to an administrative resolution.', false),
    (p_id, 4, 'ELC Claim', 'Trespass continues after notice, or boundary remains disputed.', true);

  -- Eviction / Tenancy Dispute
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Land', 'property', 'Eviction / Tenancy Dispute', 'A landlord-tenant dispute over rent, repairs, or occupation.', ARRAY['eviction','tenancy','rent','landlord','tenant'], 'Landlord or Tenant', '6 years', 6)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Notice to Vacate / Rent Demand', 'Tenancy agreement or evidence of the tenancy exists.', false),
    (p_id, 2, 'Negotiated Settlement', 'Both parties willing to resolve without court.', false),
    (p_id, 3, 'ELC Claim', 'Notice period expired without compliance.', true);

  -- Data Breach / Privacy Violation
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Data Protection', 'other', 'Data Breach / Privacy Violation', 'Unauthorised access to, or misuse of, personal data.', ARRAY['data breach','privacy','personal data'], 'Company or Individual', '3 years', 7)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Internal Investigation', 'None, establish scope and cause first.', false),
    (p_id, 2, 'Complaint to the Office of the Data Protection Commissioner (ODPC)', 'Breach involves personal data under the Data Protection Act.', false),
    (p_id, 3, 'Demand Letter', 'Loss or damage can be evidenced.', false),
    (p_id, 4, 'High Court Claim', 'ODPC process exhausted or damages claim falls outside its remit.', true);

  -- Defamation
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Civil', 'civil_litigation', 'Defamation', 'A false statement has damaged the client''s reputation.', ARRAY['defamation','libel','slander'], 'Individual or Business', '1 year', 8)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Demand Letter / Retraction Request', 'The statement, its publication, and its falsity can be evidenced.', false),
    (p_id, 2, 'Negotiated Apology / Settlement', 'Publisher is willing to retract or apologise.', false),
    (p_id, 3, 'Court Claim', 'Retraction refused and limitation period not expired.', true);

  -- Personal Injury / Negligence
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Civil', 'civil_litigation', 'Personal Injury / Negligence', 'A client has suffered injury or loss due to another party''s negligence.', ARRAY['injury','negligence','accident'], 'Individual', '3 years', 9)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Medical Report / Evidence Gathering', 'None, establish the injury and cause first.', false),
    (p_id, 2, 'Demand Letter to Insurer / Responsible Party', 'Injury and negligence can be evidenced.', false),
    (p_id, 3, 'Negotiated Settlement', 'Insurer or responsible party is willing to settle.', false),
    (p_id, 4, 'Court Claim', 'Settlement negotiations fail or limitation period is approaching.', true);

  -- Divorce / Matrimonial Property
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Family', 'family_law', 'Divorce / Matrimonial Property', 'A marriage has broken down and/or property needs to be divided.', ARRAY['divorce','separation','matrimonial property'], 'Individual', 'No limitation', 10)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Mediation / Negotiated Separation', 'Both parties willing to negotiate.', false),
    (p_id, 2, 'Petition for Divorce', 'Grounds for divorce can be established.', true),
    (p_id, 3, 'Matrimonial Property Division Claim', 'Divorce granted or property dispute exists independently.', true);

  -- Child Custody
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Family', 'family_law', 'Child Custody', 'A dispute over custody, guardianship, or access to a child.', ARRAY['custody','guardianship','child'], 'Individual', 'No limitation', 11)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Negotiated Parenting Plan', 'Both parents willing to agree.', false),
    (p_id, 2, 'Mediation', 'Both parties open to a third-party facilitator.', false),
    (p_id, 3, 'Custody Petition', 'Negotiation and mediation unsuccessful, or urgent welfare concerns exist.', true);

  -- Succession / Probate
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Family', 'family_law', 'Succession / Probate', 'Administration of a deceased person''s estate, with or without a will.', ARRAY['succession','probate','estate','inheritance'], 'Family/Beneficiary', 'No limitation', 12)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Confirm Existence of a Will', 'None, first step in every estate matter.', false),
    (p_id, 2, 'Application for Grant of Probate / Letters of Administration', 'Death certificate and asset schedule available.', true),
    (p_id, 3, 'Distribution of Estate', 'Grant confirmed and free of objection.', false);

  -- Consumer Protection Dispute
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Consumer', 'other', 'Consumer Protection Dispute', 'A consumer has been sold defective goods or misled by a supplier.', ARRAY['consumer','defective goods','misrepresentation'], 'Individual', '6 years', 13)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Complaint to the Supplier', 'None, first, lowest-cost step.', false),
    (p_id, 2, 'Complaint to the Competition Authority of Kenya', 'Supplier unresponsive or dispute involves unfair trade practices.', false),
    (p_id, 3, 'Small Claims Court', 'Complaint unresolved and claim value is within the SCC threshold.', true);

  -- Intellectual Property Infringement
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Intellectual Property', 'intellectual_property', 'IP Infringement', 'Unauthorised use of a client''s trademark, copyright, or patent.', ARRAY['trademark','copyright','patent','infringement'], 'Business or Individual', '6 years', 14)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Cease and Desist Letter', 'Ownership of the IP right can be evidenced (registration or first use).', false),
    (p_id, 2, 'Negotiated Licence / Settlement', 'Infringer willing to negotiate.', false),
    (p_id, 3, 'Court Claim', 'Infringement continues after notice.', true);

  -- Constitutional / Human Rights Violation
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Constitutional', 'constitutional', 'Constitutional / Human Rights Violation', 'A state or private actor has violated a constitutionally protected right.', ARRAY['human rights','constitutional','judicial review'], 'Individual or Public Interest', 'No limitation', 15)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Demand Letter to the Relevant Authority', 'The violation and the responsible authority can be identified.', false),
    (p_id, 2, 'Constitutional Petition', 'Authority does not remedy the violation.', true);

  -- Company / Shareholder Dispute
  INSERT INTO problem_types (category, matter_type, title, description, keywords, typical_client, limitation_period, display_order)
  VALUES ('Corporate', 'corporate', 'Company / Shareholder Dispute', 'A dispute between shareholders, directors, or over company governance.', ARRAY['shareholder','company','governance','oppression'], 'Business', '6 years', 16)
  RETURNING id INTO p_id;
  INSERT INTO problem_solutions (problem_id, priority, solution, prerequisite, is_court_track) VALUES
    (p_id, 1, 'Review of Constitutional Documents', 'Articles of association/shareholder agreement exist.', false),
    (p_id, 2, 'Demand Letter / Notice of Dispute', 'Breach of the agreement or governance failure can be evidenced.', false),
    (p_id, 3, 'Mediation / Arbitration', 'Agreement contains an ADR clause.', false),
    (p_id, 4, 'Court Claim', 'ADR unavailable or unsuccessful.', true);
END $$;
