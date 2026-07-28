-- ============================================================
-- MATTER STAGE HISTORY
-- ============================================================
-- Records every stage transition with a timestamp, which is the raw
-- material for real cycle-time analytics: how long matters sit in each
-- stage, where the bottlenecks are, and per-owner load over time.
-- Written by the API on matter creation and on every transition.

CREATE TABLE matter_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stage_history_matter ON matter_stage_history(matter_id);
CREATE INDEX idx_stage_history_created ON matter_stage_history(created_at);

ALTER TABLE matter_stage_history ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.

-- Seed one row per existing matter so the "time in current stage" clock
-- starts from the best evidence we have (the last time it was touched).
INSERT INTO matter_stage_history (matter_id, from_stage, to_stage, created_at)
SELECT id, NULL, status, COALESCE(updated_at, created_at, NOW())
FROM legal_matters;
