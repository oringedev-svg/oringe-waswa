-- ============================================================
-- Legal Issues Table
-- ============================================================
-- Stores legal issues identified for matters.
-- Issues feed into the Risk Assessment Engine.

CREATE TABLE legal_issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    issue_type text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    severity text NOT NULL DEFAULT 'medium'
      CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source_activity_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_legal_issues_matter_id ON legal_issues(matter_id);
CREATE INDEX idx_legal_issues_severity ON legal_issues(severity);
CREATE INDEX idx_legal_issues_created_at ON legal_issues(created_at);

ALTER TABLE legal_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON legal_issues
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
