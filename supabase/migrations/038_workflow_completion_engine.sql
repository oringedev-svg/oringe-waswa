-- ============================================================
-- WORKFLOW COMPLETION ENGINE
-- ============================================================
-- Three fixes, all part of the same problem: approving an assignment did
-- not reliably move anything forward.
--
-- 1. assignments.stage_key: the intake stepper previously worked out which
--    step an assignment belonged to by searching its `instructions` text for
--    the step's quoted label. That broke the moment anyone edited the
--    wording. This column is the same string key the rest of the app
--    already uses (`legal_matters.status` / `submissions.intake_stage`),
--    set once at creation, so grouping and stage-advancement are both a
--    plain equality check.
--
--    assignments.stage_id (FK to pipeline_stages) is left in place but is no
--    longer read by the completion engine: pipeline_stages has never had a
--    single row seeded for this firm (there is no admin UI to manage it and
--    no migration inserts any), so the auto_advance/next_stage_id mechanism
--    built on top of it has been dead code since it was written. The engine
--    now runs directly against the MatterStage/IntakeStage string enums that
--    every other part of the app already reads and writes.

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS stage_key TEXT;
CREATE INDEX IF NOT EXISTS idx_assignments_stage_key ON assignments(stage_key);

-- 2. stage_completions: a structured ledger of which stage-gate requirements
--    have been met, and how. Two of the four gates declared in
--    src/lib/workContext.ts (conflict search run, decision recorded) are
--    computed live from conflict_checks and need no ledger entry. The other
--    two (an engagement letter was produced, a retainer was received) have
--    no dedicated structured column anywhere in the schema to check against.
--    Rather than guess from a document's title or type (string matching is
--    exactly what Part E of this change removes elsewhere), completing the
--    assignment tagged with that stage is what marks its gate satisfied
--    here, recorded with which assignment did it. An admin override is
--    recorded the same way, distinguished by `source`.

CREATE TABLE IF NOT EXISTS stage_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  gate_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'assignment_completion'
    CHECK (source IN ('assignment_completion', 'override')),
  satisfied_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  satisfied_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL),
  UNIQUE (matter_id, submission_id, stage_key, gate_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_completions_matter ON stage_completions(matter_id, stage_key);
CREATE INDEX IF NOT EXISTS idx_stage_completions_submission ON stage_completions(submission_id, stage_key);
-- Matches assignments/pipeline_stages (migration 031): RLS enabled, no
-- policy. All access in this app goes through createAdminClient() (service
-- role, bypasses RLS) with authorization enforced at the API route layer,
-- not via Postgres policies.
ALTER TABLE stage_completions ENABLE ROW LEVEL SECURITY;

-- 3. legal_documents: a submission-only assignment (pre-matter) had nowhere
--    to attach a deliverable in this table (matter_id was NOT NULL), so
--    assignment uploads went to a second, separate `documents` table instead
--    (built for the AI document-extraction pipeline). Matter Documents reads
--    only legal_documents, so anything uploaded via an assignment, or during
--    intake before a matter existed, silently never appeared there. Same
--    nullable-matter_id + submission_id shape already used for `assignments`
--    (migration 032), so both tables follow one convention.

ALTER TABLE legal_documents ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL;

ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_target_check;
ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_target_check
  CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_legal_documents_submission ON legal_documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_assignment ON legal_documents(assignment_id);
