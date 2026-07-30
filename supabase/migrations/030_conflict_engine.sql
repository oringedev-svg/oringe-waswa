-- ============================================================
-- Conflict Engine Output Tables
-- ============================================================
-- Engine-owned tables store computed (proposed) results.
-- Never owned by Matter Record; only written by Engines.
-- Status tracks lifecycle: proposed → reviewed → promoted

CREATE TABLE conflict_engine_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'proposed'
      CHECK (status IN ('proposed', 'reviewed', 'promoted', 'discarded')),
    conflict_type text NOT NULL
      CHECK (conflict_type IN ('opposing_party_duplicate', 'shared_person', 'related_matter')),
    conflict_summary text NOT NULL,
    related_matters uuid[] DEFAULT '{}',
    related_people uuid[] DEFAULT '{}',
    source_event text NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    promoted_at timestamptz,
    reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conflict_results_matter_id ON conflict_engine_results(matter_id);
CREATE INDEX idx_conflict_results_status ON conflict_engine_results(status);
CREATE INDEX idx_conflict_results_computed_at ON conflict_engine_results(computed_at);

-- Debug table for engine failures
CREATE TABLE conflict_engine_failures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid REFERENCES legal_matters(id) ON DELETE CASCADE,
    error_message text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conflict_failures_matter_id ON conflict_engine_failures(matter_id);
CREATE INDEX idx_conflict_failures_occurred_at ON conflict_engine_failures(occurred_at);

-- RLS: Conflict results are firm-isolated (like Matter Record)
ALTER TABLE conflict_engine_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_engine_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON conflict_engine_results
  FOR ALL TO public
  USING (
    matter_id IN (
      SELECT id FROM legal_matters WHERE firm_id = current_firm_id()
    )
  )
  WITH CHECK (
    matter_id IN (
      SELECT id FROM legal_matters WHERE firm_id = current_firm_id()
    )
  );

CREATE POLICY firm_isolation ON conflict_engine_failures
  FOR ALL TO public
  USING (
    matter_id IN (
      SELECT id FROM legal_matters WHERE firm_id = current_firm_id()
    )
  )
  WITH CHECK (
    matter_id IN (
      SELECT id FROM legal_matters WHERE firm_id = current_firm_id()
    )
  );
