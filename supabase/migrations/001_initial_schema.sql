-- ============================================================
-- ORINGE WASWA & ASSOCIATES, Complete Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'public' CHECK (role IN ('admin','staff','moderator','client','volunteer','public')),
  bio TEXT,
  location TEXT,
  linkedin_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  position TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Legal',
  specializations TEXT[] DEFAULT '{}',
  bio TEXT,
  bar_number TEXT,
  years_experience INT DEFAULT 0,
  education JSONB DEFAULT '[]',
  linkedin_url TEXT,
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('job','contact','volunteer','paper','appointment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','under_review','interview_scheduled','accepted','rejected',
    'completed','on_hold','awaiting_info'
  )),
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_phone TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  ai_summary TEXT,
  ai_score INT,
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE submission_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  sent_email BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  matter_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','cancelled','completed','no_show'
  )),
  assigned_attorney_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INT DEFAULT 60,
  location TEXT,
  meeting_link TEXT,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VOLUNTEERS
-- ============================================================
CREATE TABLE volunteers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN (
    'applied','under_review','selected','active','graduated','inactive'
  )),
  start_date DATE,
  end_date DATE,
  department TEXT,
  supervisor_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  hours_logged DECIMAL DEFAULT 0,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOG
-- ============================================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_review','published','rejected','archived'
  )),
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  moderator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  moderator_notes TEXT,
  views INT DEFAULT 0,
  reading_time_minutes INT DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_authors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','co_author','contributor')),
  is_external BOOLEAN DEFAULT false,
  group_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEGAL FILES MANAGEMENT
-- ============================================================
CREATE TABLE legal_matters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','on_hold','archived')),
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  opposing_party TEXT,
  court TEXT,
  case_number TEXT,
  assigned_attorney_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  closing_date DATE,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  is_confidential BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  version INT NOT NULL DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  access_level TEXT NOT NULL DEFAULT 'staff' CHECK (access_level IN (
    'public','client','staff','admin','confidential'
  )),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_privileged BOOLEAN DEFAULT false,
  checksum TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matter_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(matter_id, profile_id)
);

CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE NOT NULL,
  accessed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('view','download','upload','delete','share')),
  ip_address INET,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GALLERY
-- ============================================================
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSIGHTS (Video / Audio / News / Articles)
-- ============================================================
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video','audio','news','article')),
  description TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  external_url TEXT,
  source TEXT,
  category TEXT NOT NULL DEFAULT 'Legal',
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAIL LIST
-- ============================================================
CREATE TABLE mail_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE TABLE mail_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient_tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent')),
  sent_count INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CERTIFICATES
-- ============================================================
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('volunteer_graduation','participation','achievement','custom')),
  title TEXT NOT NULL,
  description TEXT,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  template_data JSONB DEFAULT '{}',
  pdf_url TEXT,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COVERAGE AREAS (MAP)
-- ============================================================
CREATE TABLE coverage_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Kenya',
  latitude DECIMAL NOT NULL,
  longitude DECIMAL NOT NULL,
  description TEXT,
  services TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SITE SETTINGS & API KEYS
-- ============================================================
CREATE TABLE site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ
);

-- ============================================================
-- TEAM MESSAGES
-- ============================================================
CREATE TABLE team_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  is_broadcast BOOLEAN DEFAULT false,
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Default coverage areas
INSERT INTO coverage_areas (name, region, country, latitude, longitude, description, services) VALUES
('Nairobi Central', 'Nairobi', 'Kenya', -1.2921, 36.8219, 'Main Office - Full legal services', ARRAY['Civil Litigation', 'Corporate Law', 'Family Law', 'Criminal Defense']),
('Mombasa', 'Coast', 'Kenya', -4.0435, 39.6682, 'Coast Region Office', ARRAY['Property Law', 'Maritime Law', 'Corporate Law']),
('Kisumu', 'Nyanza', 'Kenya', -0.0917, 34.7679, 'Western Kenya Office', ARRAY['Family Law', 'Employment Law', 'Civil Litigation']),
('Nakuru', 'Rift Valley', 'Kenya', -0.3031, 36.0800, 'Service Point', ARRAY['Property Law', 'Family Law']),
('Eldoret', 'Rift Valley', 'Kenya', 0.5143, 35.2698, 'Service Point', ARRAY['Employment Law', 'Civil Litigation']),
('Kampala', 'Central', 'Uganda', 0.3476, 32.5825, 'East Africa Partner Office', ARRAY['Corporate Law', 'Immigration']),
('Dar es Salaam', 'Dar es Salaam', 'Tanzania', -6.7924, 39.2083, 'East Africa Partner Office', ARRAY['Corporate Law', 'Maritime Law']);

-- Default site settings
INSERT INTO site_settings (key, value, description) VALUES
('firm_name', '"Oringe Waswa & Associates"', 'Official firm name'),
('firm_tagline', '"Justice. Integrity. Excellence."', 'Firm tagline'),
('firm_address', '"Nairobi, Kenya"', 'Main office address'),
('firm_phone', '"+254 700 000 000"', 'Main phone number'),
('firm_email', '"info@oringewaswa.co.ke"', 'Main email'),
('appointment_duration', '60', 'Default appointment duration in minutes'),
('working_hours', '{"start": "08:00", "end": "17:00", "days": [1,2,3,4,5]}', 'Working hours'),
('ai_model', '"gpt-4o-mini"', 'OpenAI model to use'),
('theme', '"light"', 'Default theme'),
('blog_moderation', 'true', 'Require blog moderation before publishing');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_submissions_tracking ON submissions(tracking_code);
CREATE INDEX idx_submissions_email ON submissions(submitter_email);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_type ON submissions(type);
CREATE INDEX idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_legal_matters_number ON legal_matters(matter_number);
CREATE INDEX idx_legal_docs_matter ON legal_documents(matter_id);
CREATE INDEX idx_mail_subscribers_email ON mail_subscribers(email);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Public read for blog, gallery, insights
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published blog posts are public" ON blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Admin full access blog" ON blog_posts FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gallery public read" ON gallery_images FOR SELECT USING (true);
CREATE POLICY "Admin manage gallery" ON gallery_images FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE coverage_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coverage public read" ON coverage_areas FOR SELECT USING (true);
CREATE POLICY "Admin manage coverage" ON coverage_areas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insights public read" ON insights FOR SELECT USING (true);

-- Submissions: submitters can see their own via tracking code (handled in API)
CREATE POLICY "Admin full access submissions" ON submissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Public insert submissions" ON submissions FOR INSERT WITH CHECK (true);

-- API keys: admin only
CREATE POLICY "Admin only api_keys" ON api_keys FOR ALL USING (auth.role() = 'authenticated');

-- Legal files: authenticated only
CREATE POLICY "Authenticated legal matters" ON legal_matters FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated legal docs" ON legal_documents FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_team_updated BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_blog_updated BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_legal_matters_updated BEFORE UPDATE ON legal_matters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_legal_docs_updated BEFORE UPDATE ON legal_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment blog views
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS VOID AS $$
BEGIN UPDATE blog_posts SET views = views + 1 WHERE id = post_id; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STORAGE BUCKETS (Run separately or via Supabase dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('blog-covers', 'blog-covers', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('legal-docs', 'legal-docs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('insights', 'insights', true);
