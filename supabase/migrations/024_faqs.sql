-- ============================================================
-- FAQ
-- Reduces "let me just email and ask" friction on fees, process, and
-- coverage. Placed on the Contact page rather than the homepage, to avoid
-- lengthening an already ten-section homepage further.
-- ============================================================

CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_faqs_deleted_at ON faqs(deleted_at);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_faqs', 'Manage FAQs', 'Content', 'Manage frequently asked questions')
ON CONFLICT (key) DO NOTHING;
