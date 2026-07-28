-- ============================================================
-- MATTER LIFECYCLE + CONFLICT OF INTEREST CHECKING
-- ============================================================
-- Extends legal_matters with pre-engagement stages (lead -> conflict_check
-- -> engagement_letter -> retainer_pending -> open) instead of a separate
-- "intake" table, one record per matter for its entire life, so a lead
-- carries straight through to an active matter without re-entry.
--
-- Also links legal_matters back to the submissions table, closing the gap
-- where a public contact/appointment submission and a firm's case record
-- were previously unconnected.

ALTER TABLE legal_matters DROP CONSTRAINT IF EXISTS legal_matters_status_check;
ALTER TABLE legal_matters ADD CONSTRAINT legal_matters_status_check CHECK (status IN (
  'lead', 'conflict_check', 'engagement_letter', 'retainer_pending',
  'open', 'on_hold', 'closed', 'archived', 'declined'
));
ALTER TABLE legal_matters ALTER COLUMN status SET DEFAULT 'lead';
ALTER TABLE legal_matters ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_matters_submission ON legal_matters(submission_id);

-- ============================================================
-- CONFLICT OF INTEREST CHECKS
-- ============================================================
-- A permanent, auditable record of every conflict search and the partner's
-- documented decision, not an ephemeral search box. Professional conduct
-- requires the decision to proceed (or decline) be recorded, not just made.

CREATE TABLE conflict_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  search_query TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]',
  highest_risk TEXT CHECK (highest_risk IN ('none','low','medium','high')),
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','proceed','proceed_with_conditions','declined')),
  decision_notes TEXT,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conflict_checks_matter ON conflict_checks(matter_id);

ALTER TABLE conflict_checks ENABLE ROW LEVEL SECURITY;
-- No policies, same convention as every other content table this session
-- (awards, practice_areas, testimonials, etc.): all access goes through the
-- API using the service-role client, never directly from the browser.

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_matters', 'Manage Matters', 'Legal', 'Open, edit, and progress legal matters through their lifecycle'),
  ('run_conflict_check', 'Run Conflict Checks', 'Legal', 'Search for conflicts of interest before accepting an instruction'),
  ('approve_conflict_waiver', 'Approve Conflict Decisions', 'Legal', 'Record the mandatory partner decision on a conflict check, proceed, proceed with conditions, or decline')
ON CONFLICT (key) DO NOTHING;
