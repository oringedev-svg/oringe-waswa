-- Controlled drafting-template library (migration 045). Templates remain immutable source
-- documents; client work is always created as a separate matter document.
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  source_relative_path TEXT NOT NULL UNIQUE,
  storage_path TEXT,
  file_extension TEXT NOT NULL DEFAULT 'docx' CHECK (file_extension IN ('docx','doc')),
  practice_area_keys TEXT[] NOT NULL DEFAULT '{}',
  matter_type_keys TEXT[] NOT NULL DEFAULT '{}',
  artifact_type_name TEXT,
  trigger_events TEXT[] NOT NULL DEFAULT '{}',
  usage_scope TEXT NOT NULL DEFAULT 'MATTER' CHECK (usage_scope IN ('MATTER','INTERNAL_ONLY','REFERENCE_ONLY')),
  requires_review BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  guidance TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE legal_documents
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_version INT;
CREATE INDEX IF NOT EXISTS idx_legal_documents_template ON legal_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_scope ON document_templates(usage_scope, status);
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_document_templates','Manage Document Templates','Legal','Import, classify, retire and publish controlled drafting templates')
ON CONFLICT (key) DO NOTHING;
