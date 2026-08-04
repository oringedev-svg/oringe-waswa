-- ============================================================
-- REINSTALL THE AUTH-USER LINKING TRIGGER
--
-- Confirmed live: several profiles had a genuine, confirmed, sign-in-
-- capable auth.users account whose profiles.user_id had never been set,
-- because migration 002's on_auth_user_created trigger either was never
-- applied to this project or was applied and later lost -- either way,
-- it isn't there now. A person in this state can authenticate perfectly
-- well at the Supabase layer; getSessionProfile() then finds no matching
-- profiles row and treats them as signed out, no matter how many times
-- they log in or reset their password. That's what "can't log in" was.
--
-- This is byte-for-byte the same function/trigger migration 002 defines,
-- re-run here idempotently (CREATE OR REPLACE / DROP ... IF EXISTS) so
-- it's safe regardless of whether 002 partially applied before.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email, 'client')
  ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Sweep any existing auth.users accounts whose profiles row exists but was
-- never linked (the exact bug this migration fixes, applied retroactively
-- to whoever hit it before now). auth.users itself isn't queryable from
-- plain SQL against a service-role connection the same way public tables
-- are in every Supabase setup, so this repairs by email match against
-- profiles that are missing a link -- anyone still unmatched after this
-- genuinely has no auth account yet, which is correct.
UPDATE profiles p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
  AND p.user_id IS NULL;
