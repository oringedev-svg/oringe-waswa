-- ============================================================
-- SHARED CALENDAR
-- ============================================================
-- One firm-wide calendar for meetings, court dates, deadlines, and internal
-- catch-ups. Deliberately separate from the public `appointments` table
-- (client-booked consultations from the website, unchanged) rather than a
-- migration of it, this is the internal side: staff can book a meeting
-- with a client (or a person who has no account yet), pull in colleagues,
-- and notify everyone, all before a matter exists. The admin Calendar page
-- reads both tables and merges them into one view.

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'meeting' CHECK (type IN ('meeting','court','deadline','internal','other')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_link TEXT,
  -- A meeting can be tied to a submission before a matter exists, or to a
  -- matter once one does. Neither is required, an internal catch-up needs
  -- neither.
  matter_id UUID REFERENCES legal_matters(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_start ON calendar_events(start_at);
CREATE INDEX idx_calendar_events_matter ON calendar_events(matter_id);
CREATE INDEX idx_calendar_events_submission ON calendar_events(submission_id);

-- An attendee is exactly one of: internal staff (team_member_id), a person
-- with a portal profile (profile_id, a client, most likely), or a bare
-- name/email with neither (a pre-account client, opposing counsel, any
-- external guest). This is what makes "book a meeting before an account
-- exists" possible, the meeting doesn't need the attendee to be a row
-- anywhere else yet.
CREATE TABLE calendar_event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  external_name TEXT,
  external_email TEXT,
  rsvp_status TEXT NOT NULL DEFAULT 'invited' CHECK (rsvp_status IN ('invited','accepted','declined')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_attendees_event ON calendar_event_attendees(event_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_attendees ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same
-- convention as the rest of the schema.

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_calendar', 'Manage Calendar', 'Firm', 'Schedule meetings, invite attendees, and manage the shared calendar')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Tasks before a matter exists
-- ============================================================
-- "Send it to be researched" needs to work the moment an inquiry lands, not
-- only after it becomes a matter. matter_tasks already has everything a
-- task needs (assignee, due date, status), it just required a matter_id.
-- Relaxed here so a task can point at a submission instead.
ALTER TABLE matter_tasks ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE matter_tasks ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE matter_tasks ADD CONSTRAINT matter_tasks_target_check CHECK (matter_id IS NOT NULL OR submission_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_matter_tasks_submission ON matter_tasks(submission_id);
