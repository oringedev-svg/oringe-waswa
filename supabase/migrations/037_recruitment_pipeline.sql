-- ============================================================
-- RECRUITMENT PIPELINE
-- Extends the job_openings/job_applications tables from 021_careers.sql
-- into a full pipeline: New -> Reviewing -> Shortlisted -> Interview
-- Scheduled -> Offer Extended -> Hired / Declined, with notes, an event
-- timeline, interview scheduling on the shared calendar, and a hire path
-- that creates a staff profile (onboarding) and unlocks certificate
-- issuance (certification) through the features that already exist for
-- both, rather than building parallel ones.
--
-- MANUAL STEP: bucket creation is commented out in 001_initial_schema.sql
-- (created via the Supabase dashboard instead), so this needs the same
-- treatment there. Create a private "resumes" bucket before uploads from
-- /api/careers/resume-upload will work:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- ============================================================

-- 'new'/'reviewing'/'shortlisted'/'rejected'/'hired' already existed.
-- Adding the two intermediate stages the acef-style pipeline needs, plus
-- renaming nothing, existing rows and existing API callers keep working.
ALTER TABLE job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;
ALTER TABLE job_applications ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('new', 'reviewing', 'shortlisted', 'interview_scheduled', 'offer_extended', 'hired', 'rejected'));

ALTER TABLE job_applications
  -- A real uploaded file, not just the free-text link the public form
  -- currently collects. Both are kept: resume_url stays as a fallback link,
  -- resume_file_url is populated when the candidate (or staff, on their
  -- behalf) uploads an actual file.
  ADD COLUMN IF NOT EXISTS resume_file_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_file_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  -- Set once "Hire & Onboard" runs: which profile/team_member this
  -- applicant became. NULL until then. is a link, not a duplicate of that
  -- person's record, the profile/team_member rows are the source of truth
  -- from this point on.
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  -- Set once a certificate has been issued off this application, so the
  -- "Issue Certificate" action can show what already exists instead of
  -- inviting a duplicate.
  ADD COLUMN IF NOT EXISTS certificate_id UUID REFERENCES certificates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_job_applications_assigned_to ON job_applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_job_applications_onboarded_profile ON job_applications(onboarded_profile_id);

DROP TRIGGER IF EXISTS trg_job_applications_updated ON job_applications;
CREATE TRIGGER trg_job_applications_updated BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Internal notes on an application, same shape as submission_notes
-- (017_intake_pipeline.sql): private to staff, never sent to the applicant.
CREATE TABLE job_application_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_job_application_notes_application ON job_application_notes(application_id);

-- Everything that happened to an application: stage changes, notes,
-- interview scheduled, onboarded, certified. Same shape as
-- submission_events (014_submission_events.sql).
CREATE TABLE job_application_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'status_changed', 'note_added', 'interview_scheduled', 'onboarded', 'certified'
  )),
  detail TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_job_application_events_application ON job_application_events(application_id);

-- Interview scheduling reuses the firm's shared calendar rather than a
-- parallel "interviews" table, the same way a submission's client meeting
-- already does (calendar_events.submission_id, 015_calendar.sql).
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS job_application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_job_application ON calendar_events(job_application_id);

ALTER TABLE job_application_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_application_events ENABLE ROW LEVEL SECURITY;
-- No policies: API-only access via the service-role client, same
-- convention as submission_notes and every other internal-notes table.
