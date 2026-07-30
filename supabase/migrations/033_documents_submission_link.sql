-- ============================================================
-- DOCUMENTS: ALLOW LINKING TO A SUBMISSION, NOT ONLY A MATTER
-- ============================================================
-- Same rationale as 032 for assignments: a submission-only assignment (no
-- matter yet, e.g. a pre-matter intake step) had nowhere to attach an
-- uploaded deliverable, since documents.matter_id was NOT NULL. Loosened
-- to nullable with a submission_id alternative and the same "belongs to
-- something" CHECK.

ALTER TABLE documents ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;

ALTER TABLE documents ADD CONSTRAINT documents_target_check
  CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_documents_submission ON documents(submission_id);
