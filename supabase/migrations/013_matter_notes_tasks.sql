-- ============================================================
-- MATTER NOTES + NEXT-STEP TASKS
-- ============================================================
-- Notes are the deliberate record of what was done or decided on a matter
-- (a co-counsel's cause-of-action memo, a call summary), each note snapshots
-- the stage it was made under, so the matter's story reads milestone by
-- milestone. Tasks are the forward motion: every matter should carry a next
-- step with an owner, so nothing sits with nobody accountable.

CREATE TABLE matter_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage TEXT, -- the matter's stage when the note was made
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matter_notes_matter ON matter_notes(matter_id);

CREATE TABLE matter_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  done_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matter_tasks_matter ON matter_tasks(matter_id);

ALTER TABLE matter_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_tasks ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.
