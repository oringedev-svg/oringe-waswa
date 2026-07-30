-- ============================================================
-- FIX: profiles RLS recursion (URGENT) + public read for marketing content
--
-- 1. CRITICAL BUG introduced by migration 028.
--
-- 028 replaced the profiles policy with:
--
--     USING (user_id = auth.uid()
--            OR firm_id = (SELECT p.firm_id FROM profiles p
--                          WHERE p.user_id = auth.uid() LIMIT 1))
--
-- That subquery selects FROM profiles inside a policy ON profiles, so
-- Postgres raises "infinite recursion detected in policy for relation
-- profiles" on every read. 028 avoided calling current_firm_id() here for
-- exactly this reason and then reintroduced the same recursion by hand.
--
-- The blast radius is total, not cosmetic: src/middleware.ts:143 reads
-- profiles with the anon key plus the user's session (an RLS-bound
-- client) to resolve the caller's role. The recursion error makes that
-- read return no row, `authorized` evaluates false, and every /admin
-- request redirects to /login?error=unauthorized. The practice
-- management system is completely inaccessible until this is applied.
--
-- The fix: a policy on profiles must never query profiles. Self-access is
-- also all the RLS-bound paths actually need, since every admin screen
-- that lists other people's profiles goes through an API route on the
-- service-role client, which bypasses RLS anyway.
-- ============================================================

DROP POLICY IF EXISTS profiles_self_or_firm ON profiles;
DROP POLICY IF EXISTS firm_isolation ON profiles;
DROP POLICY IF EXISTS profiles_self_read ON profiles;
DROP POLICY IF EXISTS profiles_self_update ON profiles;

-- Non-recursive: compares a column to auth.uid() and nothing else.
CREATE POLICY profiles_self_read ON profiles
  FOR SELECT USING (user_id = auth.uid());

-- Lets a signed-in user maintain their own profile. Still no subquery.
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- current_firm_id() reads profiles and is SECURITY DEFINER, so it runs as
-- the function owner and bypasses the policies above. Pinning search_path
-- is standard practice for a SECURITY DEFINER function: without it, the
-- resolution of `profiles` depends on the caller's search_path.
CREATE OR REPLACE FUNCTION current_firm_id() RETURNS UUID
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT firm_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 2. Public read access for genuinely public marketing content.
--
-- Several of these tables have had RLS enabled with no SELECT policy
-- since earlier migrations, which means anon reads have been returning
-- zero rows for a while. That has been invisible because every public
-- page fetches server-side through the service-role client, which
-- ignores RLS. It works, but it is wrong in principle: this is published
-- marketing content, and the moment any component fetches it directly
-- the page would silently render empty.
--
-- Read-only, and restricted to rows that are actually published: a
-- soft-deleted practice area or an unpublished draft stays invisible.
-- ============================================================

-- Tables carrying a deleted_at soft-delete column.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'practice_areas','practice_area_groups','awards','testimonials',
    'events','coverage_areas','faqs','case_results','job_openings',
    'client_resources','gallery_images','insights'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS public_read ON public.%I', t);
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t AND column_name='deleted_at'
      ) THEN
        EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT USING (deleted_at IS NULL)', t);
      ELSE
        EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT USING (true)', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Team members: only those the firm has chosen to show publicly.
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON team_members;
CREATE POLICY public_read ON team_members
  FOR SELECT USING (is_visible = true AND is_active = true);

-- Blog: published posts only, never drafts or pending review.
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON blog_posts;
CREATE POLICY public_read ON blog_posts
  FOR SELECT USING (status = 'published');

ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON blog_authors;
CREATE POLICY public_read ON blog_authors FOR SELECT USING (true);

-- The courts register is national reference data, not firm property, and
-- the public Capabilities/court pages may surface it.
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read ON courts;
CREATE POLICY public_read ON courts
  FOR SELECT USING (deleted_at IS NULL AND is_active = true);

-- Deliberately NOT opened to anon: site_settings (a key/value store whose
-- contents are served through a curated /api/settings/public route),
-- submissions, legal_matters, invoices, profiles, and everything else
-- tenant-private. Those stay firm-isolated per ADR-001.
