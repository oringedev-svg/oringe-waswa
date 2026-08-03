-- Work-orchestration workspace foundations. Checklist items are copied into
-- an assignment at creation; editing a template can never rewrite live work.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS quality_score SMALLINT
  CHECK (quality_score IS NULL OR quality_score BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS assignment_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  sequence INT NOT NULL CHECK (sequence > 0),
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_assignment_checklist_assignment ON assignment_checklist_items(assignment_id, sequence);

CREATE TABLE IF NOT EXISTS assignment_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  mentioned_profile_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment ON assignment_comments(assignment_id, created_at);

-- Participants make role-based collaboration visible without conflating
-- ownership, reviewer and contributor roles.
CREATE TABLE IF NOT EXISTS assignment_participants (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','REVIEWER','RESEARCH_PARTNER','SECRETARY','OBSERVER')),
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assignment_id, profile_id, role)
);

ALTER TABLE assignment_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_participants ENABLE ROW LEVEL SECURITY;
