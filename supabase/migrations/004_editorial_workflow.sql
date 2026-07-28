-- ============================================================
-- EDITORIAL APPROVAL WORKFLOW
-- ============================================================
-- Draft -> Ready for Review -> Approved -> Scheduled -> Published -> Archived
-- "Changes Requested" sends a post back to Draft with reviewer comments attached.

-- Migrate existing values onto the new state names before changing the constraint.
UPDATE blog_posts SET status = 'ready_for_review' WHERE status = 'pending_review';
UPDATE blog_posts SET status = 'changes_requested' WHERE status = 'rejected';

ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_status_check;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_status_check CHECK (status IN (
  'draft', 'ready_for_review', 'approved', 'scheduled', 'published', 'changes_requested', 'archived'
));

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS review_comments TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Per-post transition history, separate from the generic audit_logs table
-- since this is workflow-specific and gets its own panel in the post editor.
CREATE TABLE IF NOT EXISTS blog_post_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  comments TEXT,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_status_history_post ON blog_post_status_history(post_id);

ALTER TABLE blog_post_status_history ENABLE ROW LEVEL SECURITY;
