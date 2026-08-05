-- ============================================================
-- INDEXES ON HOT COLUMNS THE APP ACTUALLY FILTERS ON
--
-- Deliberately narrow, not the "index every column" pass. Each entry
-- corresponds to a specific query in the codebase that filters or joins
-- on this column against a growing table, and none of them had an index
-- before now. Grepped the current API layer to confirm every one is a
-- real hot path, not speculative.
--
-- Indexes cost writes and space; adding them to columns nothing filters
-- on is negative-value work. So this is short on purpose.
-- ============================================================

-- profiles.user_id: getSessionProfile() reads this on EVERY authenticated
-- request (11 .eq('id') and one .eq('user_id') across the codebase, plus
-- middleware.ts's own service-role lookup on every /admin, /api, /desk
-- and /portal request). This is the single hottest query in the system.
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id) WHERE user_id IS NOT NULL;

-- profiles.email: unique constraint gives a lookup index, but only fast
-- for exact case. Auth flows normalize to lower(); make that path fast too.
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(lower(email));

-- team_members.profile_id: the "who's the team member for this signed-in
-- user" resolution, done by /api/desk/overview, /api/me consumers,
-- assignment access checks, matter access scope, and the whole team page.
-- No index existed for a table with 4 .eq('profile_id') consumers.
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON team_members(profile_id) WHERE profile_id IS NOT NULL;

-- team_members.is_active: the public team listing and every internal
-- team picker filters .eq('is_active', true), which without an index does
-- a seq scan of every row. Partial to keep it small (a firm's team is
-- mostly active).
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active) WHERE is_active = TRUE;

-- matter_people.matter_id: getMatterAccessScope() and every matter detail
-- page filters on this; the reverse .eq('profile_id') is how a person
-- discovers the matters they're a party to.
CREATE INDEX IF NOT EXISTS idx_matter_people_matter_id ON matter_people(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_people_profile_id ON matter_people(profile_id);

-- blog_comments.post_id: the per-post moderation load and the pending
-- count aggregation on the blog list both filter here. Zero indexes on
-- this whole table before now.
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments(post_id);
-- Partial: the pending count query filters .eq('is_approved', false)
-- specifically, so a partial index on that predicate is smaller AND
-- faster than a full one.
CREATE INDEX IF NOT EXISTS idx_blog_comments_pending ON blog_comments(post_id) WHERE is_approved = FALSE;

-- blog_posts.status: the list is filtered by status on every admin load;
-- previously a table scan since blog_posts had no status index.
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
