-- Architecture reconciliation: activate the existing work-item queue rather
-- than creating a competing work_queue_items model. `legal_matters` remains
-- the canonical Matter table and its existing practice_area_id remains the
-- primary classification for backwards compatibility.

CREATE TABLE IF NOT EXISTS matter_practice_areas (
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  practice_area_id UUID NOT NULL REFERENCES practice_areas(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (matter_id, practice_area_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_matter_practice_areas_one_primary
  ON matter_practice_areas(matter_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_matter_practice_areas_area
  ON matter_practice_areas(practice_area_id, matter_id);

-- Every legacy primary practice area is represented in the junction table.
INSERT INTO matter_practice_areas (matter_id, practice_area_id, is_primary)
SELECT id, practice_area_id, TRUE
FROM legal_matters
WHERE practice_area_id IS NOT NULL
ON CONFLICT (matter_id, practice_area_id) DO UPDATE SET is_primary = TRUE;

-- A claim is an immutable audit attempt. The conditional update in the API
-- makes only one concurrent claimant succeed; all other attempts are DENIED.
CREATE TABLE IF NOT EXISTS work_item_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  claimant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimant_team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ATTEMPTED','GRANTED','DENIED','WITHDRAWN')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_work_item_claims_item ON work_item_claims(work_item_id, created_at DESC);

-- Explicit work graph for runtime activities. Assignment dependencies in 040
-- remain execution guards after work is assigned; these edges describe work
-- before and after an assignment is created.
CREATE TABLE IF NOT EXISTS work_item_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  related_work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('BLOCKS','INFORMS','PARALLEL_WITH','PARENT','CHILD','RELATED','DERIVED_FROM','FOLLOW_UP')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (work_item_id <> related_work_item_id),
  UNIQUE (work_item_id, related_work_item_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS idx_work_item_relationships_item ON work_item_relationships(work_item_id);

-- Assignment rows describe a handover; this preserves who owned it and why.
CREATE TABLE IF NOT EXISTS assignment_ownership_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  from_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  to_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_ownership_history_assignment
  ON assignment_ownership_history(assignment_id, created_at DESC);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_sla_policy ON assignments(sla_policy_id);

ALTER TABLE matter_practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_ownership_history ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('claim_work', 'Claim Queued Work', 'Operations', 'Claim eligible unassigned work from the firm work queue'),
  ('manage_work_graph', 'Manage Work Graph', 'Operations', 'Create and manage work-item relationships and dependencies')
ON CONFLICT (key) DO NOTHING;
