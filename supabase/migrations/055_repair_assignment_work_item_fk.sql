-- ============================================================
-- REPAIR THE MISSING assignments.work_item_id FOREIGN KEY
--
-- Migration 034 declares this column WITH its reference:
--
--   ALTER TABLE assignments ADD COLUMN IF NOT EXISTS work_item_id UUID
--     REFERENCES work_items(id) ON DELETE SET NULL;
--
-- but ADD COLUMN IF NOT EXISTS is all-or-nothing: when the column already
-- exists, Postgres skips the entire statement, REFERENCES clause included.
-- So on this deployment the column is present and the constraint never was.
--
-- That isn't cosmetic. PostgREST resolves embedded selects
-- (work_item:work_items(...)) through foreign keys, and with none to find
-- it fails the WHOLE query rather than just omitting the embed -- which is
-- why opening any assignment returned "Assignment not found" for work that
-- existed and belonged to the person opening it.
--
-- The API no longer depends on this embed, so applying this is a
-- correctness repair rather than the fix itself; both exist deliberately,
-- since a schema this drifted shouldn't have a page's behaviour riding on
-- a constraint being present.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'assignments'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'work_item_id'
  ) THEN
    -- Clear any orphans first, or ADD CONSTRAINT will fail validation.
    UPDATE assignments a
    SET work_item_id = NULL
    WHERE a.work_item_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM work_items w WHERE w.id = a.work_item_id);

    ALTER TABLE assignments
      ADD CONSTRAINT assignments_work_item_id_fkey
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assignments_work_item ON assignments(work_item_id);
