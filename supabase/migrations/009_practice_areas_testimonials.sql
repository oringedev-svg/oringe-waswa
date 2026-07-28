-- ============================================================
-- PRACTICE AREAS & TESTIMONIALS
-- ============================================================
-- These were previously hardcoded arrays in ServicesSection.tsx,
-- services/page.tsx, and TestimonialsSection.tsx. Bringing them into
-- the same content-table + soft-delete pattern as awards/events so
-- they're editable from the admin without a code change.
--
-- manage_practice_areas was already registered in 003_permissions.sql
-- (planned but never implemented), reused here, not re-inserted.

CREATE TABLE practice_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description TEXT,
  highlights TEXT[] DEFAULT '{}',
  image_url TEXT,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  client_role TEXT,
  quote TEXT NOT NULL,
  avatar_url TEXT,
  display_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practice_areas_deleted_at ON practice_areas(deleted_at);
CREATE INDEX idx_testimonials_deleted_at ON testimonials(deleted_at);

ALTER TABLE practice_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
-- No policies, same convention as awards/events/client_resources.
-- All reads/writes go through the API using the service-role client.

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_testimonials', 'Manage Testimonials', 'Content', 'Manage client testimonials')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DATA, carries over the content that was previously hardcoded,
-- so the homepage/services page/nav aren't empty after this migration.
-- ============================================================

INSERT INTO practice_areas (title, slug, short_description, description, highlights, image_url, display_order) VALUES
  ('Civil Litigation', 'civil-litigation',
   'Expert representation in civil disputes, contract matters, and tort claims.',
   'Our litigation team brings decades of courtroom experience to every civil dispute. We handle commercial disputes, contract breaches, tort claims, and more with strategic precision.',
   ARRAY['Contract Disputes','Tort Claims','Debt Recovery','Injunctions','Appeals'],
   'https://images.unsplash.com/photo-1750365501430-395251fe4b7e?auto=format&fit=crop&w=1200&q=80', 1),
  ('Criminal Defense', 'criminal-defense',
   'Vigorous defense of your rights from investigation through trial and appeals.',
   'When your freedom is at stake, our criminal defense attorneys provide vigorous representation from investigation through trial and appeals.',
   ARRAY['Bail Applications','Pre-trial Hearings','Trial Representation','Appeals','White-collar Crime'],
   'https://images.unsplash.com/photo-1767972463877-b64ba4283cd0?auto=format&fit=crop&w=1200&q=80', 2),
  ('Family Law', 'family-law',
   'Compassionate guidance through divorce, custody, adoption, and matrimonial property.',
   'We provide compassionate, practical guidance through the most sensitive family legal matters, prioritising the well-being of all parties involved.',
   ARRAY['Divorce & Separation','Child Custody','Adoption','Matrimonial Property','Succession'],
   'https://images.unsplash.com/photo-1516901408257-500ed7566e6a?auto=format&fit=crop&w=1200&q=80', 3),
  ('Corporate Law', 'corporate',
   'Comprehensive corporate advisory, M&A, governance, and commercial transactions.',
   'Comprehensive corporate advisory services supporting businesses from incorporation through complex M&A transactions and ongoing governance matters.',
   ARRAY['Company Formation','M&A Transactions','Corporate Governance','Commercial Contracts','Regulatory Compliance'],
   'https://images.unsplash.com/photo-1745015446589-7ee6f702d8c1?auto=format&fit=crop&w=1200&q=80', 4),
  ('Property Law', 'property',
   'Conveyancing, land disputes, title searches, and real estate transactions.',
   'Expert guidance through all aspects of real estate law including conveyancing, land registration, and property dispute resolution across Kenya.',
   ARRAY['Conveyancing','Title Searches','Land Disputes','Leases','Development Agreements'],
   'https://images.unsplash.com/photo-1741156386380-0236c72eb6f9?auto=format&fit=crop&w=1200&q=80', 5),
  ('Immigration', 'immigration',
   'Work permits, visas, citizenship, and immigration compliance advisory.',
   'Navigating complex immigration laws across East Africa for individuals, families, and corporations seeking permits, visas, and citizenship.',
   ARRAY['Work Permits','Residency','Citizenship','Investor Visas','Corporate Immigration'],
   'https://images.unsplash.com/photo-1563463149242-bd378d9ab05c?auto=format&fit=crop&w=1200&q=80', 6),
  ('Employment Law', 'employment',
   'Employment contracts, wrongful termination, discrimination, and labor disputes.',
   'Protecting the rights of employers and employees in all employment-related legal matters, from drafting contracts to resolving disputes.',
   ARRAY['Employment Contracts','Wrongful Termination','Discrimination Claims','Unions','Redundancy'],
   'https://images.unsplash.com/photo-1758518730384-be3d205838e8?auto=format&fit=crop&w=1200&q=80', 7),
  ('Intellectual Property', 'intellectual-property',
   'Patents, trademarks, copyright registration, and IP enforcement strategies.',
   'Protecting your innovations, brands, and creative works through comprehensive registration, enforcement, and strategic IP management.',
   ARRAY['Patents','Trademarks','Copyright','Trade Secrets','IP Litigation'],
   'https://images.unsplash.com/photo-1763729805496-b5dbf7f00c79?auto=format&fit=crop&w=1200&q=80', 8),
  ('Constitutional Law', 'constitutional',
   'Rights enforcement, judicial review, and public interest litigation.',
   'Enforcing constitutional rights and challenging unlawful government action through judicial review and public interest litigation in Kenyan courts.',
   ARRAY['Judicial Review','Human Rights','Public Interest','Constitutional Petitions','Administrative Law'],
   'https://images.unsplash.com/photo-1658958327132-a80f8a9409fb?auto=format&fit=crop&w=1200&q=80', 9),
  ('Alternative Dispute Resolution', 'alternative-dispute',
   'Mediation, arbitration, and negotiated settlements for cost-effective resolution.',
   'Cost-effective resolution of disputes through mediation, arbitration, and negotiation, avoiding costly and time-consuming litigation where possible.',
   ARRAY['Mediation','Arbitration','Negotiation','Conciliation','Expert Determination'],
   'https://images.unsplash.com/photo-1758518732175-5d608ba3abdf?auto=format&fit=crop&w=1200&q=80', 10);

INSERT INTO testimonials (client_name, client_role, quote, display_order) VALUES
  ('James Mwangi', 'CEO, Nairobi Tech Ltd', 'Oringe Waswa handled our complex corporate restructuring with exceptional expertise. Their team was responsive, strategic, and delivered outstanding results.', 1),
  ('Amina Hassan', 'Individual Client', 'During a difficult family matter, the firm treated us with compassion and professionalism. I cannot recommend them highly enough.', 2),
  ('David Ochieng', 'Managing Director', 'Their corporate team guided us through three major acquisitions. Thorough, reliable, and always available when we needed them.', 3);
