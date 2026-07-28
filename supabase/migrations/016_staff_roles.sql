-- ============================================================
-- PUPILS, ADMINISTRATIVE ASSISTANTS, AND ADVOCATE SENIORITY
-- ============================================================
-- Two new account roles alongside the existing admin/staff/moderator/
-- client/volunteer/public. Unlike staff (which carries a bundle of default
-- permissions), pupils and admin assistants start with NONE, on purpose:
-- everything they can do is granted individually through the existing
-- per-user permission system (user_permissions + /admin/users), the same
-- modular "all or some" mechanism already used for staff today. A pupil
-- given publish_articles can work the blog; nothing else opens up unless
-- someone explicitly grants it.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'admin','staff','moderator','client','volunteer','public','pupil','admin_assistant'
));

-- Seniority is about the org chart (who a person is), separate from role
-- (what they're allowed to do). A pupil's seniority is 'pupil' by
-- convention, but their profiles.role only becomes 'pupil' once they
-- actually get a login, team_members can carry seniority long before that.
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS seniority TEXT NOT NULL DEFAULT 'associate' CHECK (seniority IN (
  'partner','senior_associate','associate','pupil','admin_assistant','other'
));
