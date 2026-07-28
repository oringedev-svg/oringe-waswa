-- ============================================================
-- REVISION HISTORY
-- ============================================================
-- Generic content-versioning table. Each row is a full snapshot of the
-- content-bearing fields of a record at a point in time, taken right
-- before an edit overwrites them, so "restore" always has something
-- to go back to. Not tied to one table; table_name + record_id identify
-- what it belongs to, the same pattern as audit_logs.

CREATE TABLE content_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  data JSONB NOT NULL,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_revisions_record ON content_revisions(table_name, record_id);

ALTER TABLE content_revisions ENABLE ROW LEVEL SECURITY;
