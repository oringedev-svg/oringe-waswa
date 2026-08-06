-- ============================================================
-- EMAIL VERIFICATION (generic, reusable across every public intake form)
-- ============================================================
-- Anyone can currently type any email address into the public contact
-- form, the appointment booker, or the careers apply form and create a
-- record the firm has no way to trace back to a real person. This closes
-- that gap: every public submission is created unverified, is excluded
-- from admin views/counts/search, and only "reflects" in the system once
-- the submitter clicks the confirmation link mailed to the address they
-- actually gave.
--
-- One token table serves every submitting table, so a fourth public form
-- added later (e.g. the pupillage public intake, per the engineering
-- spec's Stage 0) only needs an email_verified_at column of its own, not
-- a parallel verification mechanism.

CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  -- Which row this token unlocks. No FK by design: it points at one of
  -- several different tables, and the app enforces the target_table
  -- allow-list rather than the database.
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verifications_target ON email_verifications(target_table, target_id);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
-- No policies, service-role client only, same convention as the rest of
-- the schema -- the token itself is the credential, not a session.

-- Each submitting table gets its own flag. NULL = not yet confirmed and
-- therefore invisible to every admin list/count/search query; every read
-- site that must not show an unconfirmed row filters on this directly
-- rather than joining email_verifications, so the filter still works even
-- for a row whose token later expired unused.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_submissions_email_verified ON submissions(email_verified_at);
CREATE INDEX IF NOT EXISTS idx_appointments_email_verified ON appointments(email_verified_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_email_verified ON job_applications(email_verified_at);
