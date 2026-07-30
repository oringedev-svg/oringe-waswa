-- ============================================================
-- TRIGGER ENGINE: THE MISSING COLUMNS, NOT A NEW SYSTEM
-- ============================================================
-- activity_types, activity_trigger_rules, and work_items (migration 030)
-- already exist and are schema-complete for a reactive workflow, they were
-- simply never wired to anything. This migration adds only what's missing
-- to make them real:
--   - which matter type an activity/rule applies to (reuse legal_matters.
--     type, a plain text value, no new matter_types table needed)
--   - what business event an activity emits on completion
--   - a delayed variant of a trigger rule, for legal deadlines that fire
--     from elapsed time rather than an immediate reaction
--   - the one real gap: assignments had no way to say which work item they
--     execute, only a matter/submission directly

-- Which matter type(s) an activity is available for. Empty = universal
-- (e.g. "Draft Affidavit" belongs to no single matter type, every matter
-- type's trigger rules can create one).
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS applies_to_matter_types TEXT[] DEFAULT '{}';

-- The business event this activity's completion represents, e.g.
-- 'demand_letter_sent', not a generic 'work_item_completed'. Read by the
-- trigger engine when a work item of this type is completed.
ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS on_complete_event TEXT;

-- A rule scoped to one matter type only fires for that type; NULL is
-- universal (matches every matter type, same convention as activity_types).
ALTER TABLE activity_trigger_rules ADD COLUMN IF NOT EXISTS matter_type TEXT;

-- A rule's action is one of: create a work item now (creates_activity_
-- type_id, unchanged), or emit a follow-on event, either immediately or
-- after delay_days. Modelling "the response period expired" this way,
-- as a scheduled event, is what keeps a waiting period from ever becoming
-- a dummy work item, per the workflow philosophy: legal events drive
-- progress, not "click Next Stage."
ALTER TABLE activity_trigger_rules ALTER COLUMN creates_activity_type_id DROP NOT NULL;
ALTER TABLE activity_trigger_rules ADD COLUMN IF NOT EXISTS emits_event TEXT;
ALTER TABLE activity_trigger_rules ADD COLUMN IF NOT EXISTS delay_days INT;
ALTER TABLE activity_trigger_rules ADD CONSTRAINT activity_trigger_rules_action_check
  CHECK (creates_activity_type_id IS NOT NULL OR emits_event IS NOT NULL);

-- Assignments execute work items; they should not need a matter_id or
-- submission_id of their own once a work item is the real target (the
-- work item already carries that). Nullable and additive, existing
-- assignments (matter_id/submission_id directly) keep working unchanged.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_work_item ON assignments(work_item_id);
