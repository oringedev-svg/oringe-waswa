-- ============================================================
-- Document Intelligence Engine Output Tables
-- ============================================================
-- Stores proposed extractions from documents.

CREATE TABLE document_intelligence_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    matter_id uuid NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'proposed'
      CHECK (status IN ('proposed', 'promoted', 'rejected')),
    extracted_text text NOT NULL,
    proposed_case_summary text,
    proposed_key_dates text[] DEFAULT '{}',
    proposed_parties text[] DEFAULT '{}',
    proposed_issues text[] DEFAULT '{}',
    confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    source_event text NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT now(),
    promoted_at timestamptz,
    rejected_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    rejected_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_intel_matter_id ON document_intelligence_results(matter_id);
CREATE INDEX idx_doc_intel_document_id ON document_intelligence_results(document_id);
CREATE INDEX idx_doc_intel_status ON document_intelligence_results(status);
CREATE INDEX idx_doc_intel_computed_at ON document_intelligence_results(computed_at);

ALTER TABLE document_intelligence_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON document_intelligence_results
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
