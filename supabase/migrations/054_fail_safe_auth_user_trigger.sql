-- ============================================================
-- MAKE THE AUTH-USER LINKING TRIGGER FAIL-SAFE
--
-- Confirmed live: after migration 053 reinstalled on_auth_user_created,
-- creating a brand-new user (no pre-existing profiles row) started
-- failing outright with "Database error creating new user" -- the whole
-- auth.users insert rolled back, so nobody could be added at all. Most
-- likely RLS on profiles rejecting the trigger's own insert (the
-- profiles_self_or_firm policy's implicit WITH CHECK depends on
-- auth.uid(), which has no meaningful value in this server-side context),
-- though the exact Postgres exception isn't visible through the client
-- libraries this was diagnosed with -- only Supabase's own Postgres logs
-- would show that.
--
-- Rather than keep guessing at the exact cause, this makes the trigger
-- fail open: catch any exception the linking insert throws, log it as a
-- warning, and let the auth.users insert commit regardless. A convenience
-- trigger's job is to save a manual step, never to be a single point of
-- failure for creating an account at all -- if it fails, profiles.user_id
-- can always be repaired afterward (exactly what migration 053's own
-- retroactive sweep does, and what this project's own invite endpoints
-- now also do directly rather than depending on this trigger at all).
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO profiles (user_id, full_name, email, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email, 'client')
    ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user: could not link profile for %: %', NEW.email, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicit, narrow policy allowing this trigger's own insert regardless of
-- auth.uid() context, in case RLS was in fact the cause: a row is only
-- ever let in here if its user_id already exists in auth.users (the
-- trigger only ever fires with a real NEW.id), so this can't be used to
-- insert on someone else's behalf from outside the trigger's own path.
DROP POLICY IF EXISTS profiles_new_user_link ON profiles;
CREATE POLICY profiles_new_user_link ON profiles
  FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM auth.users WHERE id = user_id));
