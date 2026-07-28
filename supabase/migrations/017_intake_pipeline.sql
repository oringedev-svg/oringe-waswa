-- ============================================================
-- INTAKE PIPELINE (pre-matter) + CONTINUOUS CONFLICT CHECKING
-- ============================================================
-- Formalises the journey a legal enquiry actually follows before it
-- becomes a matter: Client Request -> Conflict Check -> Problem
-- Identification -> Client Instruction -> Legal Opinion -> Retention ->
-- Promoted to Matter. This is a SEPARATE tracking dimension from
-- submissions.status (which stays generic and is shared by every
-- submission type: job applications, volunteering, papers, not just legal
-- enquiries), intake_stage only applies to 'contact' and 'appointment'
-- submissions, the ones that can become a matter at all.
--
-- The matter's own lifecycle (lead -> conflict_check -> ...) picks up
-- exactly where this leaves off, so the two pipelines read as one
-- continuous line rather than two disconnected trackers.

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS intake_stage TEXT CHECK (intake_stage IN (
  'received','conflict_check','problem_identification','client_instruction',
  'legal_opinion','retention','promoted','declined'
));

-- Backfill: legal-enquiry submissions that already exist start at 'received'
-- so nothing appears blank; non-legal types (job/volunteer/paper) stay NULL.
UPDATE submissions SET intake_stage = 'received'
WHERE type IN ('contact','appointment') AND intake_stage IS NULL;

-- Conflict checking needs to run at BOTH stages of one continuous pipeline:
-- on the submission, before a matter exists, and again on the matter
-- itself once it does. Relax matter_id to nullable and add submission_id,
-- so the same table and the same UI serve both moments, a check run
-- pre-matter carries forward onto the matter at promotion (matter_id gets
-- set on the existing row) rather than starting the record over.
ALTER TABLE conflict_checks ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE conflict_checks ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE conflict_checks ADD CONSTRAINT conflict_checks_target_check CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_submission ON conflict_checks(submission_id);

-- Each non-conflict-check pipeline step (Problem Identification, Client
-- Instruction, Legal Opinion, Retention) records a short note as it's
-- completed, the substance of the step, not just a timestamp. Reuses the
-- same shape as matter_notes rather than inventing a parallel table.
CREATE TABLE submission_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  stage TEXT, -- the intake stage this note was recorded under
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_notes_submission ON submission_notes(submission_id);

ALTER TABLE submission_notes ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.
