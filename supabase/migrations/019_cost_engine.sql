-- ============================================================
-- COST INTELLIGENCE ENGINE
-- ============================================================
-- Legal fees are never hardcoded in application code. A legal instrument
-- (Advocates Remuneration Order, a court fees schedule, etc) is converted
-- into structured data: instrument -> schedule -> rule -> band/condition.
-- The application only knows how to EXECUTE a calculation strategy
-- (FIXED, BANDED_PERCENTAGE, HOURLY, ...), src/lib/costEngine.ts. Adding
-- or amending a legal instrument is a content update (JSON import), not a
-- code change. See src/lib/instrumentImport.ts for the import/validation
-- path this schema is designed around.

-- One row per legal instrument, versioned. Never edited after activation,
-- an amendment creates a new row (same slug, new version), and the import
-- flow archives the previous ACTIVE row for that slug.
CREATE TABLE legal_instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  authority TEXT,
  instrument_type TEXT,
  version TEXT NOT NULL,
  effective_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived','invalid')),
  pdf_url TEXT,
  source_note TEXT,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_legal_instruments_slug_status ON legal_instruments(slug, status);

CREATE TABLE fee_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instrument_id UUID REFERENCES legal_instruments(id) ON DELETE CASCADE NOT NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT
);

CREATE TABLE fee_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES fee_schedules(id) ON DELETE CASCADE NOT NULL,
  paragraph TEXT,
  name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN (
    'FIXED','FLAT_PERCENTAGE','BANDED_PERCENTAGE','HOURLY',
    'PER_PAGE','PER_ITEM','PER_ATTENDANCE','PER_DOCUMENT','PER_HEARING','DISCRETIONARY'
  )),
  band_mode TEXT CHECK (band_mode IN ('summed','step_marginal')),
  minimum NUMERIC,
  maximum NUMERIC,
  fixed_amount NUMERIC,
  unit_rate NUMERIC,
  currency TEXT NOT NULL DEFAULT 'KES',
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fee_rules_schedule ON fee_rules(schedule_id);

-- Bands for BANDED_PERCENTAGE rules. flat_amount on a band is the resolved
-- base for that band (a pure flat fee if rate is null, or the starting
-- point a marginal rate is added to if rate is set), this keeps the
-- calculation engine a single lookup, no chained "previous band" resolution.
CREATE TABLE fee_rule_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES fee_rules(id) ON DELETE CASCADE NOT NULL,
  from_value NUMERIC NOT NULL,
  to_value NUMERIC,
  rate NUMERIC,
  flat_amount NUMERIC,
  sequence INT NOT NULL
);

CREATE INDEX idx_fee_rule_bands_rule ON fee_rule_bands(rule_id);

-- Conditions gate whether a rule applies at all, evaluated against a
-- resolved matter (matterType, court category, claimValue, county, see
-- resolveField() in src/lib/costEngine.ts).
CREATE TABLE fee_rule_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES fee_rules(id) ON DELETE CASCADE NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('=','!=','>','>=','<','<=','IN','NOT IN')),
  value TEXT NOT NULL
);

CREATE TABLE fee_rule_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES fee_rules(id) ON DELETE CASCADE NOT NULL,
  plain_language TEXT NOT NULL,
  legal_reference TEXT
);

-- A calculated/accepted fee attached to a real matter, the record of what
-- was actually estimated, confirmed, or paid, independent of later edits
-- to the rule that suggested it (explanation is a snapshot, see below).
CREATE TABLE matter_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  rule_id UUID REFERENCES fee_rules(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('court_cost','advocate_fee','government_charge','disbursement','tax')),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  vat_applicable BOOLEAN DEFAULT false,
  vat_amount NUMERIC DEFAULT 0,
  recoverable TEXT CHECK (recoverable IN ('party_and_party','advocate_and_client','not_recoverable')),
  status TEXT NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated','confirmed','paid')),
  explanation JSONB,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matter_fees_matter ON matter_fees(matter_id);

-- Lightweight future-cost line items, manually logged against a stage
-- label. No automated procedural-stage engine exists in this codebase
-- (matter_tasks are freeform), so this is entered by hand rather than
-- triggered by a workflow event.
CREATE TABLE cost_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  stage_label TEXT NOT NULL,
  expected_cost NUMERIC NOT NULL,
  confidence TEXT CHECK (confidence IN ('low','medium','high')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-logged whenever a matter_fees row's amount or status changes, same
-- audit-trail convention as matter_stage_history/conflict_checks.
CREATE TABLE cost_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  matter_fee_id UUID REFERENCES matter_fees(id) ON DELETE SET NULL,
  old_amount NUMERIC,
  new_amount NUMERIC,
  reason TEXT,
  trigger TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE legal_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rule_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rule_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_history ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_fee_schedules', 'Manage Fee Schedules', 'Legal', 'Import and edit legal instruments, schedules, and fee rules'),
  ('manage_matter_costs', 'Manage Matter Costs', 'Legal', 'Add, accept, and confirm cost estimates on a matter')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DATA, Advocates (Remuneration) Order, two schedules.
-- ============================================================
-- Sourced via automated web research against Kenya Law's consolidated
-- text during setup, NOT a verified legal transcription. Every rule below
-- carries this caveat in its own explanation row so it surfaces in the
-- product UI itself, not just here. Confirm against the current gazetted
-- Order before relying on this for an actual client quote.

DO $$
DECLARE
  instrument_id UUID;
  schedule6_id UUID;
  schedule1_id UUID;
  rule6_id UUID;
  rule1_id UUID;
BEGIN
  INSERT INTO legal_instruments (slug, name, authority, instrument_type, version, effective_date, status, source_note)
  VALUES (
    'aro',
    'Advocates (Remuneration) Order',
    'Chief Justice',
    'Remuneration Order',
    '2014 (consolidated text)',
    '2014-01-01',
    'active',
    'Sourced via automated web research against Kenya Law''s consolidated text during initial setup, not a verified legal transcription. Confirm every figure against the current gazetted Order before relying on it for a client-facing quote or bill of costs.'
  )
  RETURNING id INTO instrument_id;

  -- Schedule 6: High Court
  INSERT INTO fee_schedules (instrument_id, number, title, description)
  VALUES (instrument_id, '6', 'High Court', 'Instruction fees and related costs for proceedings in the High Court')
  RETURNING id INTO schedule6_id;

  INSERT INTO fee_rules (schedule_id, paragraph, name, calculation_type, band_mode, minimum, currency, priority)
  VALUES (schedule6_id, '1(b)', 'Instruction Fee (Defended Claim)', 'BANDED_PERCENTAGE', 'step_marginal', 75000, 'KES', 1)
  RETURNING id INTO rule6_id;

  INSERT INTO fee_rule_bands (rule_id, from_value, to_value, rate, flat_amount, sequence) VALUES
    (rule6_id, 0, 500000, NULL, 75000, 1),
    (rule6_id, 500000, 750000, NULL, 90000, 2),
    (rule6_id, 750000, 1000000, NULL, 120000, 3),
    (rule6_id, 1000000, 20000000, 0.02, 120000, 4),
    (rule6_id, 20000000, NULL, 0.015, 500000, 5);

  INSERT INTO fee_rule_conditions (rule_id, field, operator, value) VALUES
    (rule6_id, 'matterType', 'IN', 'civil_litigation,corporate');

  INSERT INTO fee_rule_explanations (rule_id, plain_language, legal_reference) VALUES
    (rule6_id, 'The instruction fee for suing on a defended civil claim in the High Court, banded by claim value. UNVERIFIED: sourced via automated web research, confirm against the current gazetted Order before relying on this for a client quote.', 'Advocates (Remuneration) Order, Schedule 6, Paragraph 1(b)');

  -- Schedule 1: Conveyancing & Securities (first scale, sales/purchases)
  INSERT INTO fee_schedules (instrument_id, number, title, description)
  VALUES (instrument_id, '1', 'Conveyancing & Securities', 'Instruction fees for sales, purchases, mortgages, and charges affecting registered land')
  RETURNING id INTO schedule1_id;

  INSERT INTO fee_rules (schedule_id, paragraph, name, calculation_type, band_mode, minimum, currency, priority)
  VALUES (schedule1_id, '1(a)', 'Instruction Fee (Sale/Purchase)', 'BANDED_PERCENTAGE', 'summed', 35000, 'KES', 1)
  RETURNING id INTO rule1_id;

  INSERT INTO fee_rule_bands (rule_id, from_value, to_value, rate, flat_amount, sequence) VALUES
    (rule1_id, 0, 5000000, 0.02, NULL, 1),
    (rule1_id, 5000000, 100000000, 0.015, NULL, 2),
    (rule1_id, 100000000, 250000000, 0.0125, NULL, 3),
    (rule1_id, 250000000, 1000000000, 0.01, NULL, 4),
    (rule1_id, 1000000000, NULL, 0.001, NULL, 5);

  INSERT INTO fee_rule_conditions (rule_id, field, operator, value) VALUES
    (rule1_id, 'matterType', '=', 'property');

  INSERT INTO fee_rule_explanations (rule_id, plain_language, legal_reference) VALUES
    (rule1_id, 'The instruction fee for acting on a sale or purchase of registered land, 2% of the consideration (or KES 35,000, whichever is higher) up to KES 5,000,000, with a lower marginal percentage on each band above that. UNVERIFIED: sourced via automated web research, confirm against the current gazetted Order before relying on this for a client quote.', 'Advocates (Remuneration) Order, Schedule 1, Paragraph 1(a)');
END $$;
