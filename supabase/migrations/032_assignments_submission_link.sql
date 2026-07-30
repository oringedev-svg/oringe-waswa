-- ============================================================
-- ASSIGNMENTS: ALLOW LINKING TO A SUBMISSION, NOT ONLY A MATTER
-- ============================================================
-- Assignments originally required matter_id NOT NULL, so work could only
-- be assigned once a submission had been promoted to a matter. But real
-- intake work happens before that: screening a job application, following
-- up a volunteer enquiry, triaging a contact form, none of which ever
-- become a legal matter (promoteToMatter only applies to contact/appointment
-- types). The "Assign To" control on the submission detail page needs a
-- real assignment to attach to at that stage, so matter_id is loosened to
-- nullable and submission_id is added, with a CHECK that at least one of
-- the two is set, an assignment always belongs to something.

ALTER TABLE assignments ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;

ALTER TABLE assignments ADD CONSTRAINT assignments_target_check
  CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_assignments_submission ON assignments(submission_id);
