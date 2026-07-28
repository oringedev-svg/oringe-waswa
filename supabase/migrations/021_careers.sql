-- ============================================================
-- CAREERS, job openings + applications
-- Categories mirror the five-way Careers menu split (Trainee Program,
-- Qualified Lawyers, Business Services, Support Staff, plus the standing
-- Vacancy List these all feed into) rather than an open-ended free-text
-- field, so the public page can group postings the same way.
-- ============================================================

CREATE TABLE job_openings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'qualified_lawyers'
    CHECK (category IN ('trainee_program', 'qualified_lawyers', 'business_services', 'support_staff')),
  location TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  summary TEXT,
  description TEXT,
  requirements TEXT,
  deadline DATE,
  is_open BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES job_openings(id) ON DELETE SET NULL,
  category TEXT NOT NULL
    CHECK (category IN ('trainee_program', 'qualified_lawyers', 'business_services', 'support_staff')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_openings_deleted_at ON job_openings(deleted_at);
CREATE INDEX idx_job_openings_category ON job_openings(category);
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Register the permission for the Permission Engine, same as every other
-- content module, shows up under Admin -> Users -> Permissions with no
-- code changes needed there.
INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_careers', 'Manage Careers', 'Content', 'Manage job openings and review applications')
ON CONFLICT (key) DO NOTHING;
