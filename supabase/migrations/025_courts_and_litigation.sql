-- ============================================================
-- COURTS REGISTER + LITIGATION TRACKING
--
-- legal_matters.court was free text, so the same court could be recorded as
-- "Milimani", "milimani commercial", or "Commercial Court Nairobi" and never
-- reconcile. This adds a controlled register of Kenyan courts and points
-- matters at it by id.
--
-- It also separates two things the schema previously conflated. The existing
-- matter STAGE is the engagement lifecycle (lead -> conflict check ->
-- engagement letter -> retainer -> open). Litigation status is a different
-- axis entirely: where the dispute itself has reached, which in Kenyan
-- practice usually starts with a demand letter and may never see a
-- courtroom at all.
--
-- Court structure follows the Constitution of Kenya 2010 (Chapter 10):
-- superior courts are the Supreme Court, Court of Appeal, High Court, and
-- the two courts of High Court status (ELC and ELRC). Subordinate courts
-- are the Magistrates' Courts, Kadhis' Courts, Courts Martial, the Small
-- Claims Court, and tribunals.
-- ============================================================

CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  -- Court type, not the station. Drives which matters may be filed here.
  court_type TEXT NOT NULL CHECK (court_type IN (
    'supreme', 'court_of_appeal', 'high_court', 'elc', 'elrc',
    'magistrate', 'kadhi', 'small_claims', 'tribunal', 'court_martial'
  )),
  -- Superior courts bind lower ones; kept explicit so the UI can group by
  -- hierarchy rather than inferring it from the type string.
  is_superior BOOLEAN NOT NULL DEFAULT false,
  station TEXT,           -- e.g. Milimani, Mombasa, Kisumu
  county TEXT,
  physical_address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courts_type ON courts(court_type);
CREATE INDEX idx_courts_deleted_at ON courts(deleted_at);
CREATE UNIQUE INDEX idx_courts_name_station ON courts(name, COALESCE(station, ''));

ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

-- Matters now reference the register. The old free-text `court` column is
-- deliberately left in place rather than dropped: existing rows still hold
-- values, and dropping it would lose them. New writes should use court_id.
ALTER TABLE legal_matters ADD COLUMN court_id UUID REFERENCES courts(id) ON DELETE SET NULL;
ALTER TABLE legal_matters ADD COLUMN litigation_status TEXT NOT NULL DEFAULT 'pre_action'
  CHECK (litigation_status IN (
    'pre_action',
    'demand_letter_served',
    'negotiation',
    'adr_mediation',
    'arbitration',
    'filed_in_court',
    'in_court',
    'judgment_delivered',
    'appeal',
    'execution',
    'settled_out_of_court',
    'withdrawn',
    'concluded'
  ));
-- Set the day the suit was actually filed, which is what limitation periods
-- and the court diary key off, not the day the file was opened.
ALTER TABLE legal_matters ADD COLUMN filed_at DATE;

CREATE INDEX idx_legal_matters_court_id ON legal_matters(court_id);
CREATE INDEX idx_legal_matters_litigation_status ON legal_matters(litigation_status);

-- ============================================================
-- SEED: Kenyan courts
-- Station lists cover the principal registries rather than every one of the
-- 100+ magistrate stations; the register is admin-editable so a firm adds
-- the local stations it actually appears in.
-- ============================================================

INSERT INTO courts (name, court_type, is_superior, station, county, notes, display_order) VALUES
('Supreme Court of Kenya', 'supreme', true, 'Nairobi', 'Nairobi', 'Final appellate court. Limited jurisdiction under Article 163.', 1),

('Court of Appeal', 'court_of_appeal', true, 'Nairobi', 'Nairobi', NULL, 2),
('Court of Appeal', 'court_of_appeal', true, 'Mombasa', 'Mombasa', NULL, 3),
('Court of Appeal', 'court_of_appeal', true, 'Kisumu', 'Kisumu', NULL, 4),
('Court of Appeal', 'court_of_appeal', true, 'Nakuru', 'Nakuru', NULL, 5),
('Court of Appeal', 'court_of_appeal', true, 'Nyeri', 'Nyeri', NULL, 6),
('Court of Appeal', 'court_of_appeal', true, 'Eldoret', 'Uasin Gishu', NULL, 7),
('Court of Appeal', 'court_of_appeal', true, 'Malindi', 'Kilifi', NULL, 8),

('High Court of Kenya', 'high_court', true, 'Milimani, Nairobi', 'Nairobi', 'Includes the Commercial and Admiralty, Family, Civil, Criminal, Judicial Review and Constitutional divisions.', 10),
('High Court of Kenya', 'high_court', true, 'Mombasa', 'Mombasa', NULL, 11),
('High Court of Kenya', 'high_court', true, 'Kisumu', 'Kisumu', NULL, 12),
('High Court of Kenya', 'high_court', true, 'Nakuru', 'Nakuru', NULL, 13),
('High Court of Kenya', 'high_court', true, 'Eldoret', 'Uasin Gishu', NULL, 14),
('High Court of Kenya', 'high_court', true, 'Nyeri', 'Nyeri', NULL, 15),
('High Court of Kenya', 'high_court', true, 'Machakos', 'Machakos', NULL, 16),
('High Court of Kenya', 'high_court', true, 'Meru', 'Meru', NULL, 17),
('High Court of Kenya', 'high_court', true, 'Kakamega', 'Kakamega', NULL, 18),
('High Court of Kenya', 'high_court', true, 'Kisii', 'Kisii', NULL, 19),
('High Court of Kenya', 'high_court', true, 'Bungoma', 'Bungoma', NULL, 20),
('High Court of Kenya', 'high_court', true, 'Garissa', 'Garissa', NULL, 21),
('High Court of Kenya', 'high_court', true, 'Embu', 'Embu', NULL, 22),
('High Court of Kenya', 'high_court', true, 'Kerugoya', 'Kirinyaga', NULL, 23),
('High Court of Kenya', 'high_court', true, 'Malindi', 'Kilifi', NULL, 24),
('High Court of Kenya', 'high_court', true, 'Kitale', 'Trans Nzoia', NULL, 25),
('High Court of Kenya', 'high_court', true, 'Migori', 'Migori', NULL, 26),
('High Court of Kenya', 'high_court', true, 'Homa Bay', 'Homa Bay', NULL, 27),
('High Court of Kenya', 'high_court', true, 'Kajiado', 'Kajiado', NULL, 28),
('High Court of Kenya', 'high_court', true, 'Nanyuki', 'Laikipia', NULL, 29),
('High Court of Kenya', 'high_court', true, 'Busia', 'Busia', NULL, 30),
('High Court of Kenya', 'high_court', true, 'Narok', 'Narok', NULL, 31),

('Environment and Land Court', 'elc', true, 'Milimani, Nairobi', 'Nairobi', 'Status of the High Court. Land, title, boundary, eviction and environmental disputes.', 40),
('Environment and Land Court', 'elc', true, 'Mombasa', 'Mombasa', NULL, 41),
('Environment and Land Court', 'elc', true, 'Kisumu', 'Kisumu', NULL, 42),
('Environment and Land Court', 'elc', true, 'Nakuru', 'Nakuru', NULL, 43),
('Environment and Land Court', 'elc', true, 'Eldoret', 'Uasin Gishu', NULL, 44),
('Environment and Land Court', 'elc', true, 'Nyeri', 'Nyeri', NULL, 45),
('Environment and Land Court', 'elc', true, 'Machakos', 'Machakos', NULL, 46),
('Environment and Land Court', 'elc', true, 'Meru', 'Meru', NULL, 47),
('Environment and Land Court', 'elc', true, 'Kakamega', 'Kakamega', NULL, 48),
('Environment and Land Court', 'elc', true, 'Kericho', 'Kericho', NULL, 49),
('Environment and Land Court', 'elc', true, 'Kitale', 'Trans Nzoia', NULL, 50),
('Environment and Land Court', 'elc', true, 'Malindi', 'Kilifi', NULL, 51),
('Environment and Land Court', 'elc', true, 'Embu', 'Embu', NULL, 52),
('Environment and Land Court', 'elc', true, 'Bungoma', 'Bungoma', NULL, 53),
('Environment and Land Court', 'elc', true, 'Busia', 'Busia', NULL, 54),
('Environment and Land Court', 'elc', true, 'Kerugoya', 'Kirinyaga', NULL, 55),
('Environment and Land Court', 'elc', true, 'Migori', 'Migori', NULL, 56),
('Environment and Land Court', 'elc', true, 'Narok', 'Narok', NULL, 57),
('Environment and Land Court', 'elc', true, 'Nanyuki', 'Laikipia', NULL, 58),
('Environment and Land Court', 'elc', true, 'Garissa', 'Garissa', NULL, 59),

('Employment and Labour Relations Court', 'elrc', true, 'Milimani, Nairobi', 'Nairobi', 'Status of the High Court. Unfair termination, unpaid dues, trade union and collective bargaining disputes.', 70),
('Employment and Labour Relations Court', 'elrc', true, 'Mombasa', 'Mombasa', NULL, 71),
('Employment and Labour Relations Court', 'elrc', true, 'Kisumu', 'Kisumu', NULL, 72),
('Employment and Labour Relations Court', 'elrc', true, 'Nakuru', 'Nakuru', NULL, 73),
('Employment and Labour Relations Court', 'elrc', true, 'Nyeri', 'Nyeri', NULL, 74),
('Employment and Labour Relations Court', 'elrc', true, 'Eldoret', 'Uasin Gishu', NULL, 75),
('Employment and Labour Relations Court', 'elrc', true, 'Kericho', 'Kericho', NULL, 76),
('Employment and Labour Relations Court', 'elrc', true, 'Machakos', 'Machakos', NULL, 77),
('Employment and Labour Relations Court', 'elrc', true, 'Meru', 'Meru', NULL, 78),
('Employment and Labour Relations Court', 'elrc', true, 'Bungoma', 'Bungoma', NULL, 79),
('Employment and Labour Relations Court', 'elrc', true, 'Malindi', 'Kilifi', NULL, 80),
('Employment and Labour Relations Court', 'elrc', true, 'Nyahururu', 'Laikipia', NULL, 81),
('Employment and Labour Relations Court', 'elrc', true, 'Garissa', 'Garissa', NULL, 82),

('Milimani Commercial Courts', 'magistrate', false, 'Milimani, Nairobi', 'Nairobi', 'Principal magistrate station for Nairobi commercial and debt recovery claims.', 90),
('Milimani Law Courts', 'magistrate', false, 'Milimani, Nairobi', 'Nairobi', 'Civil and criminal magistrate divisions.', 91),
('Kibera Law Courts', 'magistrate', false, 'Kibera, Nairobi', 'Nairobi', NULL, 92),
('Makadara Law Courts', 'magistrate', false, 'Makadara, Nairobi', 'Nairobi', NULL, 93),
('Kayole Law Courts', 'magistrate', false, 'Kayole, Nairobi', 'Nairobi', NULL, 94),
('Thika Law Courts', 'magistrate', false, 'Thika', 'Kiambu', NULL, 95),
('Kiambu Law Courts', 'magistrate', false, 'Kiambu', 'Kiambu', NULL, 96),
('Machakos Law Courts', 'magistrate', false, 'Machakos', 'Machakos', NULL, 97),
('Kajiado Law Courts', 'magistrate', false, 'Kajiado', 'Kajiado', NULL, 98),
('Nakuru Law Courts', 'magistrate', false, 'Nakuru', 'Nakuru', NULL, 99),
('Mombasa Law Courts', 'magistrate', false, 'Mombasa', 'Mombasa', NULL, 100),
('Kisumu Law Courts', 'magistrate', false, 'Kisumu', 'Kisumu', NULL, 101),
('Eldoret Law Courts', 'magistrate', false, 'Eldoret', 'Uasin Gishu', NULL, 102),
('Nyeri Law Courts', 'magistrate', false, 'Nyeri', 'Nyeri', NULL, 103),
('Kakamega Law Courts', 'magistrate', false, 'Kakamega', 'Kakamega', NULL, 104),

('Small Claims Court', 'small_claims', false, 'Milimani, Nairobi', 'Nairobi', 'Claims up to KES 1,000,000 under the Small Claims Court Act. Advocate representation is limited.', 120),
('Small Claims Court', 'small_claims', false, 'Mombasa', 'Mombasa', NULL, 121),
('Small Claims Court', 'small_claims', false, 'Kisumu', 'Kisumu', NULL, 122),
('Small Claims Court', 'small_claims', false, 'Nakuru', 'Nakuru', NULL, 123),

('Kadhis'' Court', 'kadhi', false, 'Nairobi', 'Nairobi', 'Muslim personal law (personal status, marriage, divorce, inheritance) where all parties profess the Muslim faith. Article 170.', 140),
('Kadhis'' Court', 'kadhi', false, 'Mombasa', 'Mombasa', NULL, 141),
('Kadhis'' Court', 'kadhi', false, 'Garissa', 'Garissa', NULL, 142),

('Business Premises Rent Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', 'Controlled tenancies under Cap 301.', 160),
('Rent Restriction Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', 'Residential tenancies under Cap 296.', 161),
('Tax Appeals Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', 'Appeals against KRA assessments under the Tax Appeals Tribunal Act.', 162),
('National Environment Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', 'Appeals against NEMA decisions under EMCA.', 163),
('Co-operative Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', 'Co-operative society disputes.', 164),
('Political Parties Disputes Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', NULL, 165),
('Sports Disputes Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', NULL, 166),
('Energy and Petroleum Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', NULL, 167),
('HIV and AIDS Tribunal', 'tribunal', false, 'Nairobi', 'Nairobi', NULL, 168),
('Transport Licensing Appeals Board', 'tribunal', false, 'Nairobi', 'Nairobi', NULL, 169);

-- ============================================================
-- STAFF VOICES ("Working at Oringe")
-- Reuses the existing testimonials table rather than creating a parallel
-- one: a testimonial is a testimonial, the only real difference is whose
-- voice it is. Client quotes stay the default so nothing existing changes.
-- ============================================================
ALTER TABLE testimonials ADD COLUMN kind TEXT NOT NULL DEFAULT 'client'
  CHECK (kind IN ('client', 'staff'));
ALTER TABLE testimonials ADD COLUMN years_at_firm TEXT;
CREATE INDEX idx_testimonials_kind ON testimonials(kind);

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_courts', 'Manage Courts Register', 'Legal', 'Maintain the register of courts matters can be filed in')
ON CONFLICT (key) DO NOTHING;
