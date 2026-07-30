-- ============================================================
-- Deadline Engine Output Tables
-- ============================================================
-- Stores proposed filing and response deadlines computed
-- from hearing dates and judge preferences.

CREATE TABLE deadline_engine_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'proposed'
      CHECK (status IN ('proposed', 'promoted', 'rejected')),
    deadline_type text NOT NULL
      CHECK (deadline_type IN ('filing', 'response', 'appearance', 'other')),
    due_date date NOT NULL,
    description text NOT NULL,
    source_event text NOT NULL,
    source_hearing_id uuid NOT NULL REFERENCES hearings(id) ON DELETE CASCADE,
    computed_at timestamptz NOT NULL DEFAULT now(),
    promoted_at timestamptz,
    rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    rejected_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deadline_results_matter_id ON deadline_engine_results(matter_id);
CREATE INDEX idx_deadline_results_status ON deadline_engine_results(status);
CREATE INDEX idx_deadline_results_due_date ON deadline_engine_results(due_date);
CREATE INDEX idx_deadline_results_computed_at ON deadline_engine_results(computed_at);

-- RLS: Deadline results are firm-isolated
ALTER TABLE deadline_engine_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON deadline_engine_results
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
