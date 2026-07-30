-- ============================================================
-- Risk Assessment Engine Output Tables
-- ============================================================
-- Stores proposed risk assessments computed from legal issues.

CREATE TABLE risk_assessment_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'proposed'
      CHECK (status IN ('proposed', 'promoted', 'rejected')),
    risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level text NOT NULL
      CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    factors text[] NOT NULL DEFAULT '{}',
    description text NOT NULL,
    source_event text NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    promoted_at timestamptz,
    rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    rejected_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_results_matter_id ON risk_assessment_results(matter_id);
CREATE INDEX idx_risk_results_status ON risk_assessment_results(status);
CREATE INDEX idx_risk_results_risk_level ON risk_assessment_results(risk_level);
CREATE INDEX idx_risk_results_computed_at ON risk_assessment_results(computed_at);

ALTER TABLE risk_assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON risk_assessment_results
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
