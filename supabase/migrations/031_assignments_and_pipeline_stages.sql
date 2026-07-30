-- ============================================================
-- ASSIGNMENT LIFECYCLE + CONFIGURABLE PIPELINE STAGES
-- ============================================================
-- Separates workflow orchestration (pipeline stages) from work execution
-- (assignments). A matter progresses through stages; within each stage,
-- assignments represent specific work items that must be completed.
--
-- Pipeline Stages define:
-- • the workflow steps (Conflict Check, Engagement Letter, Drafting, etc.)
-- • whether approval auto-advances the matter to the next stage
-- • whether to auto-create the next stage's assignment on completion
-- • prerequisites and validation rules
--
-- Assignments represent work within a stage:
-- • Assigned → Accepted → In Progress → Submitted → Approved/Rejected
-- • Rejections allow the reviewer to choose reassignment strategy
-- • Revocations allow the assigner to immediately reassign or claim the work
-- • Full audit trail via assignment_messages with message_type classification

-- ============================================================
-- 1. PIPELINE STAGE DEFINITIONS
-- ============================================================
-- Each row defines one step in a matter's lifecycle and controls
-- how approval triggers matter progression.

CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID REFERENCES firms(id) NOT NULL,
  key TEXT NOT NULL, -- e.g., 'conflict_check', 'engagement_letter', 'open'
  label TEXT NOT NULL, -- e.g., 'Conflict Check', 'Engagement Letter'
  description TEXT,

  -- Workflow orchestration: what happens when an assignment in this stage is approved
  auto_advance BOOLEAN DEFAULT FALSE, -- auto-move matter to next_stage on approval?
  next_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  auto_create_next_assignment BOOLEAN DEFAULT FALSE, -- create assignment in next stage?

  -- Validation
  requires_approval BOOLEAN DEFAULT TRUE,
  requires_documents BOOLEAN DEFAULT FALSE,

  -- Lifecycle
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  UNIQUE(firm_id, key)
);

CREATE INDEX idx_pipeline_stages_firm ON pipeline_stages(firm_id);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ASSIGNMENTS: Work within a pipeline stage
-- ============================================================
-- Each assignment represents a discrete unit of work assigned to one person.
-- Status progression is explicit and auditable, not implicit.

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,

  -- Lifecycle
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,

  -- Statuses: Assigned → Accepted → In Progress → Submitted → Approved/Rejected/Revoked/Cancelled
  status TEXT NOT NULL DEFAULT 'Assigned' CHECK (status IN (
    'Assigned', 'Accepted', 'In Progress', 'Submitted',
    'Approved', 'Rejected', 'Revoked', 'Cancelled'
  )),

  -- Timestamps for each state transition
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ, -- either approved or rejected
  revoked_at TIMESTAMPTZ,

  -- Rejection handling
  rejection_reason TEXT,
  rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Notes visible to assignee
  instructions TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_matter ON assignments(matter_id);
CREATE INDEX idx_assignments_assigned_to ON assignments(assigned_to);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_stage ON assignments(stage_id);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. ASSIGNMENT MESSAGES: Assignment-specific discussion thread
-- ============================================================
-- Every assignment has its own audit trail of questions, clarifications,
-- and review comments. Message types (Comment, Review, System, Decision)
-- allow structured event recording.

CREATE TABLE assignment_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,

  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL DEFAULT 'Comment' CHECK (message_type IN (
    'Comment', 'Review', 'System', 'Decision'
  )),
  content TEXT NOT NULL,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignment_messages_assignment ON assignment_messages(assignment_id);
CREATE INDEX idx_assignment_messages_unread ON assignment_messages(assignment_id, is_read);

ALTER TABLE assignment_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. DOCUMENTS: Deliverables linked to assignments
-- ============================================================
-- Document metadata with approval workflow support and versioning.

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_size INT,
  mime_type TEXT,

  -- Document metadata
  document_type TEXT, -- e.g., 'retainer_agreement', 'engagement_letter', 'brief'
  version INT DEFAULT 1,
  is_final_version BOOLEAN DEFAULT FALSE,

  -- Review requirements
  requires_review BOOLEAN DEFAULT FALSE,
  review_deadline DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Audit
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_matter ON documents(matter_id);
CREATE INDEX idx_documents_assignment ON documents(assignment_id);
CREATE INDEX idx_documents_requires_review ON documents(requires_review, approved_at);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. PERMISSIONS for the assignment system
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('assign_work', 'Assign Work', 'Work', 'Create and manage work assignments for team members'),
  ('view_assigned_work', 'View Assigned Work', 'Work', 'See work assigned to you'),
  ('approve_work', 'Approve Work', 'Work', 'Review submitted assignments and approve or reject'),
  ('manage_pipeline', 'Manage Pipeline', 'Work', 'Configure pipeline stages and auto-progression rules'),
  ('upload_documents', 'Upload Documents', 'Work', 'Upload documents to assignments'),
  ('review_documents', 'Review Documents', 'Work', 'Approve or request changes to assignment documents')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 6. INITIAL PIPELINE STAGES (seed from existing matter statuses)
-- ============================================================
-- Create default pipeline stages from the legal_matters status enum.
-- Firms can customize these later via the pipeline management interface.

WITH firm_list AS (
  SELECT DISTINCT firm_id FROM profiles WHERE firm_id IS NOT NULL
)
INSERT INTO pipeline_stages (firm_id, key, label, description, auto_advance, requires_approval)
SELECT f.firm_id, 'conflict_check', 'Conflict Check', 'Search for conflicts of interest before proceeding', FALSE, TRUE
FROM firm_list f
ON CONFLICT (firm_id, key) DO NOTHING;

WITH firm_list AS (
  SELECT DISTINCT firm_id FROM profiles WHERE firm_id IS NOT NULL
)
INSERT INTO pipeline_stages (firm_id, key, label, description, auto_advance, requires_approval)
SELECT f.firm_id, 'engagement_letter', 'Engagement Letter', 'Prepare and deliver engagement letter to client', FALSE, TRUE
FROM firm_list f
ON CONFLICT (firm_id, key) DO NOTHING;

WITH firm_list AS (
  SELECT DISTINCT firm_id FROM profiles WHERE firm_id IS NOT NULL
)
INSERT INTO pipeline_stages (firm_id, key, label, description, auto_advance, requires_approval)
SELECT f.firm_id, 'retainer_pending', 'Retainer Pending', 'Awaiting retainer from client', FALSE, TRUE
FROM firm_list f
ON CONFLICT (firm_id, key) DO NOTHING;

WITH firm_list AS (
  SELECT DISTINCT firm_id FROM profiles WHERE firm_id IS NOT NULL
)
INSERT INTO pipeline_stages (firm_id, key, label, description, auto_advance, requires_approval)
SELECT f.firm_id, 'open', 'Active Matter', 'Matter is in active work', TRUE, FALSE
FROM firm_list f
ON CONFLICT (firm_id, key) DO NOTHING;

-- ============================================================
-- 7. UPDATES TO LEGAL_MATTERS
-- ============================================================
-- Add a reference to the current pipeline stage so the matter knows
-- which assignment lifecycle it's in. The stage drives the workflow.

ALTER TABLE legal_matters ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_legal_matters_stage ON legal_matters(current_stage_id);
