-- ============================================================
-- CASE RESULTS / NOTABLE OUTCOMES
-- Real, specific proof of work ("KES 45M settlement", "Case dismissed in
-- 6 months") rather than aggregate stats or practice-area descriptions,
-- the section identified as missing from the homepage.
-- ============================================================

CREATE TABLE case_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  practice_area TEXT,
  outcome TEXT NOT NULL,          -- short headline figure/result, e.g. "KES 45M Settlement" or "Case Dismissed"
  summary TEXT,                   -- one or two sentences of context
  description TEXT,               -- longer write-up for the /case-results detail view
  client_type TEXT,               -- anonymized descriptor, e.g. "Corporate Client", "Individual", never a real name
  year INT,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_results_deleted_at ON case_results(deleted_at);
CREATE INDEX idx_case_results_featured ON case_results(is_featured);

ALTER TABLE case_results ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_case_results', 'Manage Case Results', 'Content', 'Manage notable case outcomes shown on the site')
ON CONFLICT (key) DO NOTHING;
