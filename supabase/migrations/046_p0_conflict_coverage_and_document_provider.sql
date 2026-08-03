-- P0 reconciliation: a conflict decision must cover every practice area on
-- the matter at the time it was made. The existing primary practice_area_id
-- remains a compatibility pointer; matter_practice_areas is authoritative.
ALTER TABLE conflict_checks
  ADD COLUMN IF NOT EXISTS practice_area_ids UUID[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_conflict_checks_practice_area_ids
  ON conflict_checks USING GIN (practice_area_ids);

-- Keep the assignment's promised output (deliverable) distinct from its
-- concrete matter document. Existing artifact/version tables remain intact
-- for compatibility while new code can link directly to legal_documents.
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES legal_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliverables_artifact ON deliverables(artifact_id);

-- Provider metadata gives documents a stable physical-storage boundary.
-- OWA Storage is the initial provider; later providers can be added without
-- changing document callers or the legal_documents identity.
CREATE TABLE IF NOT EXISTS document_providers (
  key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO document_providers (key, display_name) VALUES
  ('owa_storage', 'OWA Storage')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS provider_key TEXT NOT NULL DEFAULT 'owa_storage' REFERENCES document_providers(key),
  ADD COLUMN IF NOT EXISTS provider_path TEXT;
CREATE INDEX IF NOT EXISTS idx_legal_documents_provider ON legal_documents(provider_key, provider_path);
