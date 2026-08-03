-- Assignment / work orchestration engine V3.
-- Existing work_items are the V3 Work Queue / Activity instances; this
-- migration deliberately extends them rather than duplicating queued work.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS health TEXT NOT NULL DEFAULT 'HEALTHY'
    CHECK (health IN ('HEALTHY','AT_RISK','OVERDUE','BLOCKED','WAITING_CLIENT','WAITING_COURT','WAITING_REGISTRY')),
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence INT NOT NULL CHECK (sequence > 0),
  activity_type_id UUID REFERENCES activity_types(id) ON DELETE SET NULL,
  UNIQUE (workflow_id, sequence)
);

CREATE TABLE IF NOT EXISTS intake_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('CLIENT_PORTAL','EMAIL','PHONE','COURT_FEED','COMPLIANCE','AI','MANUAL','DOCUMENT')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (validation_status IN ('PENDING','VALID','INVALID')),
  validation_notes TEXT,
  matched_matter_id UUID REFERENCES legal_matters(id) ON DELETE SET NULL,
  routed_to TEXT CHECK (routed_to IN ('WORK_QUEUE','DIRECT_ASSIGNMENT','REJECTED')),
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  routed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sequence INT NOT NULL CHECK (sequence > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','DONE','BLOCKED')),
  assignee_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  estimated_hours NUMERIC CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  actual_hours NUMERIC CHECK (actual_hours IS NULL OR actual_hours >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, sequence),
  CHECK (depends_on_task_id IS NULL OR depends_on_task_id <> id)
);

CREATE TABLE IF NOT EXISTS assignment_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  accepted_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROVIDED','REJECTED')),
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  provided_via TEXT CHECK (provided_via IN ('UPLOAD','MAGIC_LINK','MANUAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  output_type TEXT NOT NULL DEFAULT 'DOCUMENT' CHECK (output_type IN ('DOCUMENT','REPORT','EMAIL','INVOICE','BUNDLE','COURT_FILING','CERTIFICATE','APPROVAL','ADVICE','RESEARCH')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PRODUCED','REJECTED')),
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliverable_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number > 0),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEWER_COMMENTED','FINAL')),
  reviewer_comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deliverable_id, version_number)
);
ALTER TABLE deliverables DROP CONSTRAINT IF EXISTS deliverables_current_version_id_fkey;
ALTER TABLE deliverables ADD CONSTRAINT deliverables_current_version_id_fkey FOREIGN KEY (current_version_id) REFERENCES deliverable_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS completion_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_type TEXT NOT NULL UNIQUE,
  requires_deliverables BOOLEAN NOT NULL DEFAULT TRUE,
  requires_all_tasks_done BOOLEAN NOT NULL DEFAULT TRUE,
  requires_checklist BOOLEAN NOT NULL DEFAULT FALSE,
  requires_dependencies_met BOOLEAN NOT NULL DEFAULT TRUE,
  requires_time_logged BOOLEAN NOT NULL DEFAULT FALSE,
  requires_notes BOOLEAN NOT NULL DEFAULT FALSE,
  requires_client_confirmation BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO completion_rules (assignment_type) VALUES ('GENERAL') ON CONFLICT (assignment_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  input_id UUID REFERENCES assignment_inputs(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('CLIENT','THIRD_PARTY','ADVOCATE')),
  recipient_contact TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  usage_limit INT NOT NULL DEFAULT 1 CHECK (usage_limit > 0),
  usage_count INT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','REVOKED','EXHAUSTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (assignment_id IS NOT NULL OR task_id IS NOT NULL OR input_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT
);
CREATE TABLE IF NOT EXISTS team_member_skills (
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency TEXT CHECK (proficiency IN ('BASIC','WORKING','PROFICIENT','EXPERT')),
  PRIMARY KEY (team_member_id, skill_id)
);
CREATE TABLE IF NOT EXISTS assignment_required_skills (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, skill_id)
);
CREATE TABLE IF NOT EXISTS team_member_capacity (
  team_member_id UUID PRIMARY KEY REFERENCES team_members(id) ON DELETE CASCADE,
  capacity_hours_per_week NUMERIC NOT NULL CHECK (capacity_hours_per_week > 0),
  current_workload_hours NUMERIC NOT NULL DEFAULT 0 CHECK (current_workload_hours >= 0),
  utilization_pct NUMERIC GENERATED ALWAYS AS (current_workload_hours / NULLIF(capacity_hours_per_week,0) * 100) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assignment_costs (
  assignment_id UUID PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,
  estimated_cost NUMERIC, estimated_hours NUMERIC,
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  billing_code TEXT, rate NUMERIC
);
CREATE TABLE IF NOT EXISTS ai_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('LIKELY_OVERDUE','LIKELY_REJECTION','LIKELY_REASSIGNMENT','MISSING_DOCUMENTS','WRONG_ADVOCATE','MISSING_PRECEDENT')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS knowledge_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES deliverables(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED_FOR_LIBRARY','REJECTED')),
  precedent_created BOOLEAN NOT NULL DEFAULT FALSE,
  ai_embedding_created BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, deliverable_id)
);
CREATE TABLE IF NOT EXISTS assignment_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  matter_id UUID NOT NULL REFERENCES legal_matters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS package_members (
  package_id UUID NOT NULL REFERENCES assignment_packages(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, assignment_id)
);
CREATE TABLE IF NOT EXISTS escalation_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL UNIQUE, chain JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL UNIQUE,
  escalation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  block_over_capacity_claims BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_policy_id UUID REFERENCES escalation_policies(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS assignment_timeline_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  label TEXT NOT NULL, actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assignment_watchers (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notify_on JSONB NOT NULL DEFAULT '[]'::jsonb,
  notification_mode TEXT NOT NULL DEFAULT 'IMMEDIATE' CHECK (notification_mode IN ('IMMEDIATE','DAILY_DIGEST','WEEKLY_DIGEST','SILENT','MENTION_ONLY')),
  PRIMARY KEY (assignment_id, profile_id)
);
CREATE TABLE IF NOT EXISTS assignment_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  related_assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('PARENT','CHILD','RELATED','DUPLICATE','DERIVED_FROM','FOLLOW_UP')),
  CHECK (assignment_id <> related_assignment_id), UNIQUE (assignment_id, related_assignment_id, relationship_type)
);
-- Dependencies are execution guards; relationships above are navigational.
CREATE TABLE IF NOT EXISTS assignment_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  depends_on_assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'BLOCKS' CHECK (dependency_type IN ('BLOCKS','INFORMS')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (assignment_id <> depends_on_assignment_id),
  UNIQUE (assignment_id, depends_on_assignment_id, dependency_type)
);
CREATE TABLE IF NOT EXISTS review_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('SINGLE','DUAL','PARTNER','BLIND','SEQUENTIAL')),
  reviewer_roles JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, sequence INT,
  decision TEXT CHECK (decision IN ('APPROVE','REJECT')), decided_at TIMESTAMPTZ,
  UNIQUE (assignment_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_items_triage ON intake_items(validation_status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment_status ON tasks(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_assignment_inputs_assignment ON assignment_inputs(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_deliverables_assignment ON deliverables(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_magic_links_token_active ON magic_links(token) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_assignment_timeline_assignment ON assignment_timeline_entries(assignment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_dependencies_assignment ON assignment_dependencies(assignment_id, status);

-- Keep task blocks and assignment health deterministic whenever a dependency changes.
CREATE OR REPLACE FUNCTION sync_task_dependency_state() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DONE' THEN
    UPDATE tasks child SET status = 'PENDING', updated_at = NOW()
    WHERE child.depends_on_task_id = NEW.id AND child.status = 'BLOCKED';
  ELSIF NEW.status <> 'DONE' THEN
    UPDATE tasks child SET status = 'BLOCKED', updated_at = NOW()
    WHERE child.depends_on_task_id = NEW.id AND child.status IN ('PENDING','IN_PROGRESS');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_task_dependency_state ON tasks;
CREATE TRIGGER trg_sync_task_dependency_state AFTER UPDATE OF status ON tasks FOR EACH ROW EXECUTE FUNCTION sync_task_dependency_state();

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY; ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY; ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_inputs ENABLE ROW LEVEL SECURITY; ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE completion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY; ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_skills ENABLE ROW LEVEL SECURITY; ALTER TABLE assignment_required_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_capacity ENABLE ROW LEVEL SECURITY; ALTER TABLE assignment_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_packages ENABLE ROW LEVEL SECURITY; ALTER TABLE package_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_timeline_entries ENABLE ROW LEVEL SECURITY; ALTER TABLE assignment_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_relationships ENABLE ROW LEVEL SECURITY; ALTER TABLE review_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_dependencies ENABLE ROW LEVEL SECURITY;
