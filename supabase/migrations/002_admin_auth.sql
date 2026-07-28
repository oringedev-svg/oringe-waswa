-- ============================================================
-- ADMIN AUTHENTICATION SUPPORT
-- ============================================================

-- Allow an authenticated user to read their own profile row.
-- This is required so the app can look up a signed-in user's role
-- (admin / staff / moderator / client / volunteer / public).
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Keep a profile row in sync whenever a new auth user is created.
-- New users start as 'client', an existing admin must promote them.
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
