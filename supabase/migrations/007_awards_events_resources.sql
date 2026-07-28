-- ============================================================
-- AWARDS, EVENTS, CLIENT RESOURCES ("Nice to Have" modules)
-- ============================================================

CREATE TABLE awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  issuer TEXT,
  year INT,
  description TEXT,
  image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  location TEXT,
  image_url TEXT,
  registration_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'past', 'cancelled')),
  is_featured BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE client_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  access_level TEXT NOT NULL DEFAULT 'public' CHECK (access_level IN ('public', 'client', 'staff')),
  download_count INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_awards_deleted_at ON awards(deleted_at);
CREATE INDEX idx_events_deleted_at ON events(deleted_at);
CREATE INDEX idx_client_resources_deleted_at ON client_resources(deleted_at);

ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_resources ENABLE ROW LEVEL SECURITY;

-- Register permissions for these modules, same catalog the Permission
-- Engine already reads from. No code changes needed for them to show up
-- in Admin -> Users -> Permissions.
INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_awards', 'Manage Awards', 'Content', 'Manage firm awards and recognitions'),
  ('manage_events', 'Manage Events', 'Content', 'Manage firm events'),
  ('manage_resources', 'Manage Resources', 'Content', 'Manage client resources and downloads')
ON CONFLICT (key) DO NOTHING;
