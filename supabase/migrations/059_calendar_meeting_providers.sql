-- ============================================================
-- MEETING PROVIDERS & EXTERNAL CALENDAR SYNCHRONISATION
-- ============================================================
-- The application stays the source of truth for scheduling. What this
-- migration adds is (a) knowing *how* a meeting happens, so the system can
-- generate the conferencing link itself instead of asking someone to paste
-- one, and (b) mirroring events onto whatever personal calendar each staff
-- member already lives in.
--
-- Nothing here is required for the calendar to work. An event with
-- meeting_provider = 'physical' and no connected calendars behaves exactly
-- as it did before this migration.

SET lock_timeout = '5s';

-- ------------------------------------------------------------
-- How the meeting happens
-- ------------------------------------------------------------
-- meeting_link already existed and held a hand-pasted URL. It stays, but is
-- now written by the provider rather than typed by a human, except for
-- 'other', which is the escape hatch for a provider we don't integrate with.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS meeting_provider TEXT NOT NULL DEFAULT 'physical',
  -- The conferencing service's own id for the meeting, needed to update or
  -- cancel it later. Distinct from the calendar event id.
  ADD COLUMN IF NOT EXISTS meeting_external_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_meeting_provider_check'
  ) THEN
    ALTER TABLE calendar_events
      ADD CONSTRAINT calendar_events_meeting_provider_check
      CHECK (meeting_provider IN ('physical', 'google_meet', 'teams', 'other'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- Where a physical meeting happens
-- ------------------------------------------------------------
-- `location` was a single free-text line. Structured fields let the app show
-- a room on a dashboard, put a real street address in a map link, and send
-- an attendee something more useful than "Boardroom". `location` is kept and
-- still populated as a human-readable summary so every existing reader
-- (including the .ics builder) keeps working untouched.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS room TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS location_notes TEXT;

-- ------------------------------------------------------------
-- Per-user external calendar connections
-- ------------------------------------------------------------
-- One row per (person, provider). Holds the OAuth grant that lets the app
-- write to that person's own Google or Outlook calendar. Rows live behind
-- the service-role client only, these are bearer credentials.
CREATE TABLE IF NOT EXISTS user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  -- The account actually connected, which is not necessarily the address the
  -- person signs into this app with.
  external_email TEXT,
  -- Which calendar to write to. 'primary' for both providers unless the user
  -- later picks a different one.
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token TEXT NOT NULL,
  -- Google only returns a refresh token on first consent (prompt=consent
  -- forces a fresh one); Microsoft returns one every time. Nullable so a
  -- re-consent that omits it doesn't fail the upsert.
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  -- Lets someone keep the grant but stop the mirroring, without having to
  -- disconnect and re-consent later.
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_connections_profile
  ON user_calendar_connections(profile_id);

-- ------------------------------------------------------------
-- App event -> external event mapping
-- ------------------------------------------------------------
-- Updating or cancelling an event means finding it again on every calendar
-- it was mirrored to. Without this table the app could create external
-- events but never touch them again.
CREATE TABLE IF NOT EXISTS calendar_event_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES user_calendar_connections(id) ON DELETE CASCADE NOT NULL,
  external_event_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_error TEXT,
  UNIQUE (event_id, connection_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_sync_event
  ON calendar_event_sync(event_id);

ALTER TABLE user_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_sync ENABLE ROW LEVEL SECURITY;
-- No policies, API-only access via the service-role client, same convention
-- as calendar_events itself.
