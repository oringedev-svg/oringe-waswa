-- ============================================================
-- GUIDED WORK: ACTIVITY LIBRARY + ASSIGNMENT HANDOVERS
--
-- Activity types are firm-configured definitions, not hard-coded screens.
-- A workflow rule may create an activity; a work item is the assigned,
-- contextual instance that appears on a person's My Desk.
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  activity_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'legal_work',
  description TEXT,
  default_due_days INTEGER CHECK (default_due_days IS NULL OR default_due_days >= 0),
  default_urgency TEXT NOT NULL DEFAULT 'safe'
    CHECK (default_urgency IN ('overdue', 'almost_overdue', 'safe', 'complete', 'info')),
  eligible_roles TEXT[] NOT NULL DEFAULT '{}',
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  completion_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (firm_id, activity_key)
);

CREATE TABLE IF NOT EXISTS activity_trigger_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  source_event TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  creates_activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  assignment_strategy TEXT NOT NULL DEFAULT 'manual'
    CHECK (assignment_strategy IN ('manual', 'matter_lead', 'source_owner', 'role_queue')),
  target_role TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE RESTRICT,
  parent_work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  matter_id UUID REFERENCES legal_matters(id) ON DELETE SET NULL,
  assigned_to_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_at TIMESTAMPTZ,
  urgency TEXT NOT NULL DEFAULT 'safe'
    CHECK (urgency IN ('overdue', 'almost_overdue', 'safe', 'complete', 'info')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'in_progress', 'blocked', 'completed', 'cancelled')),
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  activity_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completion_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (submission_id IS NOT NULL OR matter_id IS NOT NULL),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS work_item_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  author_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_item_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_types_firm_active ON activity_types(firm_id, is_active);
CREATE INDEX IF NOT EXISTS idx_activity_triggers_firm_event ON activity_trigger_rules(firm_id, source_event);
CREATE INDEX IF NOT EXISTS idx_work_items_assignee_status ON work_items(assigned_to_profile_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_work_items_matter ON work_items(matter_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_submission ON work_items(submission_id, status);
CREATE INDEX IF NOT EXISTS idx_work_item_comments_item ON work_item_comments(work_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_work_item_handoffs_item ON work_item_handoffs(work_item_id, created_at);

ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_trigger_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY firm_isolation ON activity_types
  USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());
CREATE POLICY firm_isolation ON activity_trigger_rules
  USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());
CREATE POLICY firm_isolation ON work_items
  USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());
CREATE POLICY work_item_comments_firm_isolation ON work_item_comments
  USING (EXISTS (SELECT 1 FROM work_items w WHERE w.id = work_item_id AND w.firm_id = current_firm_id()));
CREATE POLICY work_item_handoffs_firm_isolation ON work_item_handoffs
  USING (EXISTS (SELECT 1 FROM work_items w WHERE w.id = work_item_id AND w.firm_id = current_firm_id()));

INSERT INTO permissions (key, label, category, description) VALUES
  ('triage_intake', 'Triage New Work', 'Operations', 'View and decide unassigned legal enquiries'),
  ('assign_work', 'Assign Work', 'Operations', 'Assign and hand over activity work to staff'),
  ('manage_activity_library', 'Manage Activity Library', 'Operations', 'Create activity types and workflow trigger rules'),
  ('view_assigned_work', 'View Assigned Work', 'Operations', 'View work assigned to the current user'),
  ('complete_assigned_work', 'Complete Assigned Work', 'Operations', 'Progress and complete work assigned to the current user')
ON CONFLICT (key) DO NOTHING;

-- A small starter library. Partners can add or refine activity types without
-- needing a new screen or code deployment.
INSERT INTO activity_types (firm_id, activity_key, name, category, default_due_days, eligible_roles, form_schema, completion_schema)
SELECT f.id, v.activity_key, v.name, v.category, v.default_due_days, v.eligible_roles::TEXT[], v.form_schema::JSONB, v.completion_schema::JSONB
FROM firms f
CROSS JOIN (VALUES
  ('client_interview', 'Client interview', 'client_contact', 2, '{admin,staff,pupil}', '{"fields":["interview_date","attendees","interview_notes"]}', '{"fields":["outcome_summary","next_step"]}'),
  ('draft_document', 'Draft document', 'legal_work', 3, '{admin,staff,pupil}', '{"fields":["document_type","source_documents","reviewer"]}', '{"fields":["document_id","draft_summary"]}'),
  ('review_document', 'Review document', 'legal_work', 2, '{admin,staff}', '{"fields":["document_id","review_scope"]}', '{"fields":["decision","review_comments"]}'),
  ('legal_research', 'Legal research', 'legal_work', 3, '{admin,staff,pupil}', '{"fields":["legal_question","jurisdiction","expected_output"]}', '{"fields":["research_note","authorities"]}')
) AS v(activity_key, name, category, default_due_days, eligible_roles, form_schema, completion_schema)
WHERE f.slug = 'oringe-waswa'
ON CONFLICT (firm_id, activity_key) DO NOTHING;
