-- ============================================================
-- PERMISSION ENGINE
-- ============================================================
-- Two tables:
--   permissions      , the catalog of assignable permissions. New modules
--                       register a new permission here; nothing else in
--                       this schema needs to change to support them.
--   user_permissions , explicit grants of a permission to a specific user,
--                       ON TOP OF whatever their role already implies by
--                       default (see ROLE_DEFAULT_PERMISSIONS in
--                       src/lib/permissions.ts). Grants are additive only.
--
-- 'admin' role always has every permission implicitly and is never stored
-- as individual rows here.

CREATE TABLE permissions (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT
);

CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the permission catalog" ON permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can read their own permission grants" ON user_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- DEFAULT CATALOG
-- ============================================================
INSERT INTO permissions (key, label, category, description) VALUES
  ('publish_articles',    'Publish Articles',     'Insights', 'Publish blog posts and insights directly'),
  ('approve_articles',    'Approve Articles',     'Insights', 'Approve or reject submitted articles'),
  ('manage_lawyers',      'Manage Lawyers',       'Team',     'Add, edit, or remove team members'),
  ('manage_practice_areas','Manage Practice Areas','Content', 'Edit the firm''s practice areas / services'),
  ('manage_settings',     'Manage Settings',      'System',   'Change global site configuration'),
  ('manage_homepage',     'Manage Homepage',      'Content',  'Edit homepage content and layout'),
  ('manage_users',        'Manage Users',         'System',   'Invite users and assign roles/permissions'),
  ('manage_media',        'Manage Media',         'Content',  'Manage the gallery and media library'),
  ('manage_seo',          'Manage SEO',           'System',   'Edit SEO defaults and per-page metadata'),
  ('manage_testimonials', 'Manage Testimonials',  'Content',  'Manage client testimonials'),
  ('manage_careers',      'Manage Careers',       'Content',  'Manage job postings and applications'),
  ('manage_faqs',         'Manage FAQs',          'Content',  'Manage frequently asked questions'),
  ('manage_forms',        'Manage Forms',         'System',   'Manage contact/intake form submissions')
ON CONFLICT (key) DO NOTHING;
