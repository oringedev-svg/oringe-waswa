-- Matter-management reference and live-data layer.
-- This extends the existing legal_matters workflow; it does not replace it.

ALTER TABLE practice_areas
  ADD COLUMN IF NOT EXISTS top_level_category TEXT,
  ADD COLUMN IF NOT EXISTS reference_description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS matter_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_area_id UUID NOT NULL REFERENCES practice_areas(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  decided_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (practice_area_id, name)
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  typical_stage TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifact_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  typical_format TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  objective_summary TEXT NOT NULL,
  is_system_created BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE legal_matters
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_area_id UUID REFERENCES practice_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matter_type_id UUID REFERENCES matter_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES team_members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS matter_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  related_matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('Depends On','Blocks','Related','Parent','Child','Referral','Evidence Source','Duplicate','Appeal Of')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (matter_id <> related_matter_id),
  UNIQUE (matter_id, related_matter_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  timeline_event_id UUID REFERENCES timeline_events(id) ON DELETE SET NULL,
  artifact_type_id UUID NOT NULL REFERENCES artifact_types(id) ON DELETE RESTRICT,
  owner_team TEXT,
  visibility TEXT NOT NULL DEFAULT 'matter_team' CHECK (visibility IN ('matter_team','client','firm_internal')),
  file_ref TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifact_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  referenced_in_matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, referenced_in_matter_id)
);

CREATE TABLE IF NOT EXISTS matter_type_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_type_id UUID NOT NULL REFERENCES matter_types(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (matter_type_id, event_id)
);

CREATE TABLE IF NOT EXISTS matter_type_template_artifacts (
  template_id UUID NOT NULL REFERENCES matter_type_templates(id) ON DELETE CASCADE,
  artifact_type_id UUID NOT NULL REFERENCES artifact_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (template_id, artifact_type_id)
);

-- Explicit matter-level access remains separate from the engagement tree.
CREATE TABLE IF NOT EXISTS matter_access (
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'collaborator' CHECK (access_level IN ('viewer','collaborator','manager')),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (matter_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_matter_types_practice_area ON matter_types(practice_area_id);
CREATE INDEX IF NOT EXISTS idx_legal_matters_reference ON legal_matters(practice_area_id, matter_type_id);
CREATE INDEX IF NOT EXISTS idx_legal_matters_engagement ON legal_matters(engagement_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_matter ON timeline_events(matter_id, event_date);
CREATE INDEX IF NOT EXISTS idx_artifacts_matter ON artifacts(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_access_profile ON matter_access(profile_id);

-- The website's existing practice-area rows are the canonical records.
UPDATE practice_areas p SET top_level_category = v.category, reference_description = v.description,
  is_active = (v.name <> 'Conveyancing')
FROM (VALUES
  ('Civil Litigation','Dispute Resolution','Commercial disputes, contract breaches, and tort claims handled with strategic precision.'),
  ('Aviation, Admiralty & Maritime Law','Specialist Sectors','Standard-scope maritime and aviation advisory.'),
  ('Criminal Defense','Specialist Sectors','Vigorous representation from investigation through trial and appeals.'),
  ('Family Law','Family & Private Client','Compassionate, practical guidance through sensitive family legal matters.'),
  ('Banking and Finance','Banking & Finance','Standard-scope banking and finance advisory.'),
  ('Corporate Law','Corporate & Commercial','Advisory from incorporation through complex M&A transactions and governance.'),
  ('Company Secretarial Work','Corporate & Commercial','Standard-scope company secretarial support.'),
  ('Property Law','Real Estate & Property','Conveyancing, land registration, and property dispute resolution across Kenya.'),
  ('Conveyancing','Real Estate & Property','Deprecated; merged into Property Law.'),
  ('Immigration','Employment & Immigration','Permits, visas, and citizenship across East Africa for individuals and corporations.'),
  ('Corporate Governance and Governance Audit','Corporate & Commercial','Standard-scope governance advisory and audit.'),
  ('Employment Law','Employment & Immigration','Protecting employer and employee rights, from contracts to dispute resolution.'),
  ('Intellectual Property','Corporate & Commercial','Registration, enforcement, and strategic management of IP.'),
  ('Due Diligence','Corporate & Commercial','Standard-scope transaction and compliance due diligence.'),
  ('Constitutional Law','Specialist Sectors','Judicial review and public interest litigation enforcing constitutional rights.'),
  ('Alternative Dispute Resolution','Dispute Resolution','Mediation, arbitration, and negotiation as an alternative to litigation.'),
  ('AML/CFT','Specialist Sectors','Compliance programmes, CDD/KYC, and regulator defence.'),
  ('Probate & Succession','Family & Private Client','Grant of representation, estate administration, and succession disputes.')
) AS v(name, category, description)
WHERE lower(p.title) = lower(v.name);

INSERT INTO practice_areas (title, slug, short_description, description, top_level_category, reference_description, is_active, display_order)
SELECT v.name, lower(regexp_replace(v.name, '[^a-zA-Z0-9]+', '-', 'g')), v.description, v.description, v.category, v.description, v.name <> 'Conveyancing', v.sort_order
FROM (VALUES
  ('Civil Litigation','Dispute Resolution','Commercial disputes, contract breaches, and tort claims handled with strategic precision.',1),
  ('Aviation, Admiralty & Maritime Law','Specialist Sectors','Standard-scope maritime and aviation advisory.',2),
  ('Criminal Defense','Specialist Sectors','Vigorous representation from investigation through trial and appeals.',3),
  ('Family Law','Family & Private Client','Compassionate, practical guidance through sensitive family legal matters.',4),
  ('Banking and Finance','Banking & Finance','Standard-scope banking and finance advisory.',5),
  ('Corporate Law','Corporate & Commercial','Advisory from incorporation through complex M&A transactions and governance.',6),
  ('Company Secretarial Work','Corporate & Commercial','Standard-scope company secretarial support.',7),
  ('Property Law','Real Estate & Property','Conveyancing, land registration, and property dispute resolution across Kenya.',8),
  ('Conveyancing','Real Estate & Property','Deprecated; merged into Property Law.',9),
  ('Immigration','Employment & Immigration','Permits, visas, and citizenship across East Africa for individuals and corporations.',10),
  ('Corporate Governance and Governance Audit','Corporate & Commercial','Standard-scope governance advisory and audit.',11),
  ('Employment Law','Employment & Immigration','Protecting employer and employee rights, from contracts to dispute resolution.',12),
  ('Intellectual Property','Corporate & Commercial','Registration, enforcement, and strategic management of IP.',13),
  ('Due Diligence','Corporate & Commercial','Standard-scope transaction and compliance due diligence.',14),
  ('Constitutional Law','Specialist Sectors','Judicial review and public interest litigation enforcing constitutional rights.',15),
  ('Alternative Dispute Resolution','Dispute Resolution','Mediation, arbitration, and negotiation as an alternative to litigation.',16),
  ('AML/CFT','Specialist Sectors','Compliance programmes, CDD/KYC, and regulator defence.',17),
  ('Probate & Succession','Family & Private Client','Grant of representation, estate administration, and succession disputes.',18)
) AS v(name, category, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM practice_areas p WHERE lower(p.title) = lower(v.name));

INSERT INTO events (name, category, typical_stage, description)
SELECT * FROM (VALUES
 ('Conflict Check','Intake','Pre-open','Screen for conflicts of interest before accepting the matter.'),('Initial Consultation','Intake','Pre-open','First meeting to understand the client objective.'),('Client Interview','Intake','Early','Structured fact-gathering with the client.'),('Legal Research','Preparation','Early','Research relevant law, precedent, or authorities.'),('Legal Opinion','Advisory','Early-Mid','Formal written legal opinion on the matter.'),('Case Strategy Meeting','Advisory','Early-Mid','Internal team meeting to align on approach.'),('Document Review','Preparation','Early-Mid','Review of client-supplied or third-party documents.'),('Evidence Collection','Preparation','Mid','Gathering supporting evidence.'),('Draft Pleading/Petition','Drafting','Mid','Drafting the originating court document.'),('Draft Agreement/Contract','Drafting','Mid','Drafting a contract, lease, or commercial agreement.'),('Draft Affidavit','Drafting','Mid','Drafting a sworn statement.'),('Correspondence','Communication','Ongoing','Letters, emails, or formal notices sent or received.'),('Negotiation','Resolution','Mid-Late','Direct negotiation between parties or counsel.'),('Mediation','Resolution','Mid-Late','Facilitated resolution session.'),('Arbitration Hearing','Resolution','Mid-Late','Arbitral tribunal hearing.'),('Court Filing','Court Process','Mid-Late','Filing a document with a court or registry.'),('Court Attendance','Court Process','Mid-Late','Appearance before a court or tribunal.'),('Hearing Preparation','Court Process','Mid-Late','Preparing for an upcoming hearing.'),('Witness Interview','Preparation','Mid','Interviewing a witness.'),('Service of Documents','Court Process','Mid','Formal service of legal documents.'),('Settlement Discussion','Resolution','Late','Discussion of settlement terms.'),('Due Diligence Review','Preparation','Mid','Structured transactional or compliance review.'),('Regulatory Filing','Compliance','Mid-Late','Filing with a regulator.'),('Closing','Transactional','Late','Completion of a transaction.'),('Matter Review','Administration','Ongoing','Periodic internal review.'),('Matter Closure','Administration','Close','Formal closure of the matter.'),('Skeleton Argument Preparation','Court Process','Mid-Late','Preparing written skeleton arguments.'),('Opening Statement','Court Process','Mid-Late','Delivering an opening statement at trial.'),('Closing Submissions','Court Process','Late','Delivering closing submissions at trial.'),('Case Management Conference','Court Process','Mid','Court-directed conference.'),('Company Registration Filing','Compliance','Mid','Filing company forms with the Registrar.'),('Stamp Duty Assessment','Transactional','Mid-Late','Assessment and payment of stamp duty.'),('Bill of Costs Taxation','Billing','Late','Preparation and taxation of a bill of costs.')
) AS v(name, category, typical_stage, description) ON CONFLICT (name) DO UPDATE SET category=EXCLUDED.category, typical_stage=EXCLUDED.typical_stage, description=EXCLUDED.description;

INSERT INTO artifact_types (name, category, typical_format, description)
SELECT * FROM (VALUES
 ('Document','File','.docx / .pdf','General work-product document.'),('Legal Opinion','File','.pdf','Formal legal opinion document.'),('Contract/Agreement','File','.docx / .pdf','Executed or draft agreement.'),('Affidavit','File','.pdf','Sworn statement.'),('Court Order','File','.pdf','Order issued by a court or tribunal.'),('Court Filing','File','.pdf','Document filed with a court or registry.'),('Correspondence','Communication','.eml / .pdf','Letter or email sent or received.'),('Meeting Minutes','Record','Text','Written record of a meeting.'),('Research Note','Record','Text','Internal research summary.'),('AI Report','Record','Text/PDF','AI-generated research or drafting summary.'),('Photo/Evidence','Media','.jpg / .png','Photographic or physical evidence record.'),('Video/Recording','Media','.mp4 / audio','Video or audio recording.'),('Time Entry','Billing','System record','Billable time logged against the matter.'),('Invoice','Billing','.pdf','Invoice issued to the client.'),('Petition','File','.docx / .pdf','Originating petition.'),('Plaint','File','.docx / .pdf','Civil suit originating document.'),('Defence','File','.docx / .pdf','Pleading filed in response to a plaint.'),('Chamber Summons','File','.docx / .pdf','Interlocutory court application.')a,('Memorandum of Appeal','File','.docx / .pdf','Grounds of appeal.'),('Petition of Appeal','File','.docx / .pdf','Criminal appeal originating document.'),('Notice of Intention to Sue','File','.pdf','Pre-litigation statutory notice.'),('Demand Letter','File','.docx / .pdf','Pre-litigation demand.'),('Interpleader Application','File','.docx / .pdf','Interpleader application.'),('Judicial Review Application','File','.docx / .pdf','Judicial review application.'),('Skeleton Arguments','File','.docx / .pdf','Written argument for a hearing.'),('Affidavit of Means','File','.docx / .pdf','Sworn statement of financial means.'),('Affidavit of Sureties','File','.docx / .pdf','Surety supporting affidavit.'),('Affidavit for Ad Colligenda Bona','File','.docx / .pdf','Urgent limited-grant affidavit.'),('Consent','File','.docx / .pdf','Signed consent of interested parties.'),('Guarantee of Sureties','File','.docx / .pdf','Surety guarantee.'),('Charge','File','.docx / .pdf','Land security instrument.'),('Discharge of Charge','File','.docx / .pdf','Land security release.'),('Deed of Conveyance','File','.docx / .pdf','Land transfer instrument.'),('Power of Attorney','File','.docx / .pdf','Authority instrument.'),('Spousal Affidavit','File','.docx / .pdf','Sworn spousal consent.'),('Agreement for Lease','File','.docx / .pdf','Pre-lease agreement.'),('Company Registration Form','File','.pdf','Statutory company forms.'),('Partnership Deed','File','.docx / .pdf','Partnership instrument.'),('Hire Purchase Agreement','File','.docx / .pdf','Hire purchase instrument.'),('Agency Agreement','File','.docx / .pdf','Commercial agency instrument.'),('Bill of Costs','File','.docx / .pdf','Itemised claim for legal costs.'),('Charge Sheet','File','.pdf','Criminal charge document.')
) AS v(name, category, typical_format, description) ON CONFLICT (name) DO UPDATE SET category=EXCLUDED.category, typical_format=EXCLUDED.typical_format, description=EXCLUDED.description;

WITH source_rows(area, name, source, decided_default) AS (VALUES
 ('Civil Litigation','Contract Disputes','Website: Key Services',false),('Civil Litigation','Tort Claims','Website: Key Services',false),('Civil Litigation','Debt Recovery','Website: Key Services',false),('Civil Litigation','Injunctions','Website: Key Services',false),('Civil Litigation','Appeals','Website: Key Services',false),('Criminal Defense','Bail Applications','Website: Key Services',false),('Criminal Defense','Pre-trial Hearings','Website: Key Services',false),('Criminal Defense','Trial Representation','Website: Key Services',false),('Criminal Defense','Appeals','Website: Key Services',false),('Criminal Defense','White-collar Crime','Website: Key Services',false),('Family Law','Divorce & Separation','Website: Key Services',false),('Family Law','Child Custody','Website: Key Services',false),('Family Law','Adoption','Website: Key Services',false),('Family Law','Matrimonial Property','Website: Key Services',false),('Family Law','Succession','Website: Key Services',false),('Corporate Law','Company Formation','Website: Key Services',false),('Corporate Law','M&A Transactions','Website: Key Services',false),('Corporate Law','Corporate Governance','Website: Key Services',false),('Corporate Law','Commercial Contracts','Website: Key Services',false),('Corporate Law','Regulatory Compliance','Website: Key Services',false),('Property Law','Conveyancing','Website: Key Services',false),('Property Law','Title Searches','Website: Key Services',false),('Property Law','Land Disputes','Website: Key Services',false),('Property Law','Leases','Website: Key Services',false),('Property Law','Development Agreements','Website: Key Services',false),('Property Law','Commercial Lease Review','Decided default',true),('Immigration','Work Permits','Website: Key Services',false),('Immigration','Residency','Website: Key Services',false),('Immigration','Citizenship','Website: Key Services',false),('Immigration','Investor Visas','Website: Key Services',false),('Immigration','Corporate Immigration','Website: Key Services',false),('Employment Law','Employment Contracts','Website: Key Services',false),('Employment Law','Wrongful Termination','Website: Key Services',false),('Employment Law','Discrimination Claims','Website: Key Services',false),('Employment Law','Unions','Website: Key Services',false),('Employment Law','Redundancy','Website: Key Services',false),('Intellectual Property','Patents','Website: Key Services',false),('Intellectual Property','Trademarks','Website: Key Services',false),('Intellectual Property','Copyright','Website: Key Services',false),('Intellectual Property','Trade Secrets','Website: Key Services',false),('Intellectual Property','IP Litigation','Website: Key Services',false),('Constitutional Law','Judicial Review','Website: Key Services',false),('Constitutional Law','Human Rights','Website: Key Services',false),('Constitutional Law','Public Interest','Website: Key Services',false),('Constitutional Law','Constitutional Petitions','Website: Key Services',false),('Constitutional Law','Administrative Law','Website: Key Services',false),('Alternative Dispute Resolution','Mediation','Website: Key Services',false),('Alternative Dispute Resolution','Arbitration','Website: Key Services',false),('Alternative Dispute Resolution','Negotiation','Website: Key Services',false),('Alternative Dispute Resolution','Conciliation','Website: Key Services',false),('Alternative Dispute Resolution','Expert Determination','Website: Key Services',false),('AML/CFT','AML/CFT Compliance Programmes','Website: Key Services',false),('AML/CFT','Customer Due Diligence & KYC Frameworks','Website: Key Services',false),('AML/CFT','Suspicious Transaction Reporting','Website: Key Services',false),('AML/CFT','FRC and Regulator Enquiries','Website: Key Services',false),('AML/CFT','Asset Preservation & Forfeiture Defence','Website: Key Services',false),('AML/CFT','Staff Training & Independent AML Audits','Website: Key Services',false),('Probate & Succession','Grant of Probate (Testate)','Website: Key Services',false),('Probate & Succession','Letters of Administration (Intestate)','Website: Key Services',false),('Probate & Succession','Grant Ad Colligenda Bona','Website: Key Services',false),('Probate & Succession','Confirmation of Grant','Website: Key Services',false),('Probate & Succession','Objection to Grant / Citation Proceedings','Website: Key Services',false),('Probate & Succession','Revocation of Grant','Website: Key Services',false),('Probate & Succession','Estate Administration','Website: Key Services',false),('Civil Litigation','Defamation','Archive: DRAFTING DOCUMENTS 2025',false),('Civil Litigation','Interpleader Proceedings','Archive: DRAFTING DOCUMENTS 2025',false),('Civil Litigation','Objection Proceedings','Archive: DRAFTING DOCUMENTS 2025',false),('Civil Litigation','Judicial Review Application','Archive: DRAFTING DOCUMENTS 2025',false),('Corporate Law','Partnership Formation','Archive: DRAFTING DOCUMENTS 2025',false),('Property Law','Charges & Discharges over Land','Archive: DRAFTING DOCUMENTS 2025',false),('Property Law','Power of Attorney (Property)','Archive: DRAFTING DOCUMENTS 2025',false),('Aviation, Admiralty & Maritime Law','Maritime Claims & Admiralty Proceedings','Decided default',true),('Aviation, Admiralty & Maritime Law','Aviation Regulatory & Commercial Advisory','Decided default',true),('Banking and Finance','Lending & Security Documentation','Decided default',true),('Banking and Finance','Banking Regulatory Compliance','Decided default',true),('Company Secretarial Work','Annual Statutory Compliance','Decided default',true),('Company Secretarial Work','Company Changes & Restructuring','Decided default',true),('Corporate Governance and Governance Audit','Governance Audit','Decided default',true),('Corporate Governance and Governance Audit','Board & Policy Advisory','Decided default',true),('Due Diligence','Corporate Transaction Due Diligence','Decided default',true),('Due Diligence','Property Due Diligence','Decided default',true),('Family Law','Guardianship Application','Decided default',true)
) INSERT INTO matter_types (practice_area_id, name, source, decided_default)
SELECT p.id, s.name, s.source, s.decided_default FROM source_rows s JOIN practice_areas p ON lower(p.title)=lower(s.area)
ON CONFLICT (practice_area_id, name) DO UPDATE SET source=EXCLUDED.source, decided_default=EXCLUDED.decided_default;

-- Starter checklist only. Other matter types intentionally begin without templates.
WITH seed(matter_name, event_name, required, notes, artifact_names) AS (VALUES
 ('Child Custody','Conflict Check',true,'Always required before matter opens',ARRAY[]::TEXT[]),('Child Custody','Initial Consultation',true,NULL,ARRAY['Meeting Minutes','Time Entry']),('Child Custody','Legal Opinion',true,NULL,ARRAY['Legal Opinion','Time Entry']),('Child Custody','Court Filing',true,'Originating summons',ARRAY['Court Filing']),('Child Custody','Court Attendance',false,'If matter is contested',ARRAY['Court Order','Time Entry']),('Commercial Lease Review','Conflict Check',true,NULL,ARRAY[]::TEXT[]),('Commercial Lease Review','Legal Research',false,NULL,ARRAY['Research Note']),('Commercial Lease Review','Legal Opinion',true,NULL,ARRAY['Legal Opinion','Time Entry']),('Commercial Lease Review','Draft Agreement/Contract',true,'Lease markup/redline',ARRAY['Contract/Agreement','Time Entry']),('Guardianship Application','Conflict Check',true,NULL,ARRAY[]::TEXT[]),('Guardianship Application','Initial Consultation',true,NULL,ARRAY['Meeting Minutes','Time Entry']),('Guardianship Application','Draft Pleading/Petition',true,'Guardianship application',ARRAY['Document','Time Entry']),('Guardianship Application','Court Attendance',true,'Guardianship order',ARRAY['Court Order','Time Entry']),('Grant of Probate (Testate)','Conflict Check',true,NULL,ARRAY[]::TEXT[]),('Grant of Probate (Testate)','Draft Pleading/Petition',true,NULL,ARRAY['Petition','Time Entry']),('Grant of Probate (Testate)','Court Filing',true,NULL,ARRAY['Court Filing','Consent']),('Grant of Probate (Testate)','Court Attendance',true,'Confirmation of grant',ARRAY['Court Order','Time Entry'])
), created AS (
 INSERT INTO matter_type_templates (matter_type_id,event_id,required,notes)
 SELECT mt.id,e.id,s.required,s.notes FROM seed s JOIN matter_types mt ON mt.name=s.matter_name JOIN events e ON e.name=s.event_name
 ON CONFLICT (matter_type_id,event_id) DO UPDATE SET required=EXCLUDED.required, notes=EXCLUDED.notes
 RETURNING id,matter_type_id,event_id
) INSERT INTO matter_type_template_artifacts (template_id,artifact_type_id)
SELECT c.id,a.id FROM created c JOIN matter_types mt ON mt.id=c.matter_type_id JOIN events e ON e.id=c.event_id JOIN seed s ON s.matter_name=mt.name AND s.event_name=e.name CROSS JOIN LATERAL unnest(s.artifact_names) n(name) JOIN artifact_types a ON a.name=n.name
ON CONFLICT DO NOTHING;

ALTER TABLE matter_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_type_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_type_template_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_access ENABLE ROW LEVEL SECURITY;
