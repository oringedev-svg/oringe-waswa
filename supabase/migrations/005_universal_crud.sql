-- ============================================================
-- UNIVERSAL CRUD ENGINE, soft delete support
-- ============================================================
-- team_members, profiles, and legal_matters already have a working
-- soft-delete equivalent (is_active / status). blog_posts uses its
-- editorial workflow status ('archived') as its soft-delete state.
-- These are the modules that previously did a hard DELETE, bringing
-- them in line so nothing here is destroyed without a recovery path.

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_submissions_deleted_at ON submissions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at ON appointments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_legal_documents_deleted_at ON legal_documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_gallery_images_deleted_at ON gallery_images(deleted_at);
CREATE INDEX IF NOT EXISTS idx_insights_deleted_at ON insights(deleted_at);
CREATE INDEX IF NOT EXISTS idx_coverage_areas_deleted_at ON coverage_areas(deleted_at);
