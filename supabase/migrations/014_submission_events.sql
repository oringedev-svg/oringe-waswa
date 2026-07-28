-- ============================================================
-- SUBMISSION ACTIVITY TIMELINE
-- ============================================================
-- Mirrors the matter_stage_history / matter_notes pattern already in use,
-- applied one step earlier: to the public inquiry itself, before it ever
-- becomes a matter. Every meaningful thing that happens to a submission,
-- opened, assigned, status changed, promoted, is logged here, so staff can
-- account for a client's journey from the moment they submitted a form.

CREATE TABLE submission_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'opened','assigned','status_changed','note_added','promoted'
  )),
  detail TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submission_events_submission ON submission_events(submission_id);

-- Tracks the moment a submission was first opened by staff, and by whom,
-- the "time to first open" figure that matters for response-time discipline.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS first_opened_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE submission_events ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.
