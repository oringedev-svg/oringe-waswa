-- ============================================================
-- ASSIGNMENTS: A DUE DATE
-- ============================================================
-- assignments has timestamps for every state transition but nothing for
-- "when is this actually due", work_items has due_at but assignments (the
-- system with real, populated data) doesn't. Needed for the calendar to
-- show task deadlines at all.

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date) WHERE due_date IS NOT NULL;
