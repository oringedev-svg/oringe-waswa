-- ============================================================
-- PRACTICE AREA GROUPS
-- Nineteen individual practice areas (a mix of the placeholder seed and
-- the real content pulled from the firm's previous site, which had
-- overlapping entries) is too flat a list for the homepage or the
-- capabilities page to present well. This groups them the way a top-tier
-- firm site does: seven named practice groups, each holding the individual
-- areas underneath it. Every group here maps to areas we actually have,
-- rather than inventing empty categories.
-- ============================================================

CREATE TABLE practice_area_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE practice_areas ADD COLUMN group_id UUID REFERENCES practice_area_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_practice_areas_group_id ON practice_areas(group_id);
CREATE INDEX idx_practice_area_groups_deleted_at ON practice_area_groups(deleted_at);

INSERT INTO practice_area_groups (name, slug, description, display_order) VALUES
('Corporate & Commercial', 'corporate-commercial', 'Company formation and governance, secretarial work, and the due diligence behind every transaction.', 1),
('Banking & Finance', 'banking-finance', 'Lending, security, and financial services work for institutions and their clients.', 2),
('Dispute Resolution', 'dispute-resolution', 'Civil, criminal, and commercial litigation, constitutional matters, and arbitration outside the courtroom.', 3),
('Real Estate & Property', 'real-estate-property', 'Conveyancing, land transactions, and the disputes that come with them.', 4),
('Family & Private Client', 'family-private-client', 'Matrimonial, succession, and the personal legal matters that need a steady hand.', 5),
('Employment & Immigration', 'employment-immigration', 'Workplace law and cross-border movement, for employers and individuals alike.', 6),
('Specialist Sectors', 'specialist-sectors', 'Intellectual property, and aviation, admiralty and maritime, where deep sector knowledge counts.', 7);

-- Two of the nineteen rows duplicate another row under a different slug
-- (Alternative Dispute Resolution and Employment Law were seeded twice,
-- once as a generic placeholder and once from the real site content), and
-- one row ("Criminal, Civil & Commercial Litigation") restates what Civil
-- Litigation and Criminal Defense already cover individually. Soft-deleted
-- rather than hard-deleted, consistent with how every other table here
-- handles removal.
UPDATE practice_areas SET deleted_at = NOW()
WHERE slug IN ('alternative-dispute-resolution', 'employment-law', 'criminal-civil-commercial-litigation');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'corporate-commercial')
WHERE slug IN ('corporate', 'company-secretarial-work', 'corporate-governance-and-audit', 'due-diligence');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'banking-finance')
WHERE slug IN ('banking-and-finance');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'dispute-resolution')
WHERE slug IN ('civil-litigation', 'criminal-defense', 'alternative-dispute', 'constitutional');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'real-estate-property')
WHERE slug IN ('property', 'conveyancing');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'family-private-client')
WHERE slug IN ('family-law');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'employment-immigration')
WHERE slug IN ('employment', 'immigration');

UPDATE practice_areas SET group_id = (SELECT id FROM practice_area_groups WHERE slug = 'specialist-sectors')
WHERE slug IN ('intellectual-property', 'aviation-admiralty-maritime-law');

-- A representative photo per group, borrowed from whichever member area
-- already has one seeded, with stock placeholders for the groups whose
-- members have no image.
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'corporate' AND image_url IS NOT NULL)
WHERE slug = 'corporate-commercial';
UPDATE practice_area_groups SET image_url = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80'
WHERE slug = 'banking-finance';
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'civil-litigation' AND image_url IS NOT NULL)
WHERE slug = 'dispute-resolution';
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'property' AND image_url IS NOT NULL)
WHERE slug = 'real-estate-property';
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'family-law' AND image_url IS NOT NULL)
WHERE slug = 'family-private-client';
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'immigration' AND image_url IS NOT NULL)
WHERE slug = 'employment-immigration';
UPDATE practice_area_groups SET image_url = (SELECT image_url FROM practice_areas WHERE slug = 'intellectual-property' AND image_url IS NOT NULL)
WHERE slug = 'specialist-sectors';

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_practice_area_groups', 'Manage Practice Area Groups', 'Content', 'Group practice areas into the categories shown on the Capabilities page')
ON CONFLICT (key) DO NOTHING;
