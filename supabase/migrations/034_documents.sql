-- ============================================================
-- Documents Table
-- ============================================================
-- Stores documents uploaded and associated with matters.

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    document_type text NOT NULL
      CHECK (document_type IN ('complaint', 'motion', 'brief', 'order', 'contract', 'other')),
    uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    file_url text,
    metadata jsonb DEFAULT '{}',
    source_activity_id uuid,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_matter_id ON documents(matter_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_processed_at ON documents(processed_at);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON documents
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
