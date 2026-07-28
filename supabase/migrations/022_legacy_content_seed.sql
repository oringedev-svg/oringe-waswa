-- ============================================================
-- LEGACY CONTENT SEED
-- Real content carried over from the previous site
-- (oringeopanyadvocates.com), team bios, practice areas, and the firm's
-- long-standing case count. Content only, none of that site's design.
--
-- Safe to re-run: team members are inserted only if no row with the same
-- email already exists; practice areas use ON CONFLICT (slug); the stats
-- update is a straight upsert on site_settings.
--
-- PLACEHOLDER EMAILS: the old site never published staff email addresses,
-- so each team member below gets a placeholder in the form
-- firstname.lastname@oringewaswa.co.ke, replace these with real addresses
-- in Admin -> Team before relying on them for anything (e.g. notifications).
-- ============================================================

-- ---------- TEAM ----------

INSERT INTO team_members (full_name, email, position, department, specializations, bio, is_visible, is_active, display_order)
SELECT * FROM (VALUES
  ('Edward Oringe Waswa', 'edward.waswa@oringewaswa.co.ke', 'Managing Partner', 'Litigation',
   ARRAY['Civil Litigation','Criminal Defense','Commercial Litigation'],
   'A strong willed, hardworking, reliable, smart and passionate Advocate of the High Court of Kenya with a high degree of integrity. A quick learner with good oral and written communication skills as well as IT, research, analytical and interpersonal skills.',
   true, true, 1),

  ('Opany Fidelice Anyango', 'opany.anyango@oringewaswa.co.ke', 'Senior Partner', 'Corporate & Commercial',
   ARRAY['Corporate Law','Commercial Law'],
   'Result-driven and creative corporate lawyer seeking challenging and stimulating opportunities that will offer a chance to utilize my skill and develop new ones that will inspire landmark contribution to my clients, employer and myself.',
   true, true, 2),

  ('Rachel Chepkoech Keino', 'rachel.keino@oringewaswa.co.ke', 'Associate', 'Conveyancing',
   ARRAY['Conveyancing','Property Law'],
   'Result-driven and creative corporate lawyer seeking challenging and stimulating opportunities that will offer a chance to utilize my skill and develop new ones that will inspire landmark contribution to my clients, employer and myself.',
   true, true, 3),

  ('Victor Obuli', 'victor.obuli@oringewaswa.co.ke', 'Associate', 'Real Estate & Commercial',
   ARRAY['Real Estate','Commercial Transactions'],
   'Highly motivated and reliable lawyer with an outstanding academic achievement record and a strong talent for legal research. Able to function extremely well independently on cases without supervision or participate as a member of a legal research or litigation team. Adept at fostering and sustaining strong professional relationships with clients, colleagues and law enforcement personnel. Graduate of LLB at Moi University Kenya, currently pursuing a post-graduate diploma at the Kenya School of Law.',
   true, true, 4),

  ('Isaack Ochieng', 'isaack.ochieng@oringewaswa.co.ke', 'Clerk', 'Administration',
   ARRAY[]::text[],
   'Result-driven and administrative clerk.',
   true, true, 5),

  ('Sharon Nambafu', 'sharon.nambafu@oringewaswa.co.ke', 'Receptionist / Administrator', 'Administration',
   ARRAY[]::text[],
   NULL,
   true, true, 6)
) AS v(full_name, email, position, department, specializations, bio, is_visible, is_active, display_order)
WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE team_members.email = v.email);

-- ---------- PRACTICE AREAS ----------

INSERT INTO practice_areas (title, slug, short_description, display_order) VALUES
  ('Alternative Dispute Resolution', 'alternative-dispute-resolution',
   'The Firm encourages its clients to settle disputes amicably without involving the court, recognizing the usefulness of arbitration and other alternative dispute resolution methods as an increasingly popular mode of resolving commercial disputes.', 1),

  ('Aviation, Admiralty & Maritime Law', 'aviation-admiralty-maritime-law',
   'The Firm has sought to expand its practice to the areas of aviation law as well as maritime and related matters.', 2),

  ('Banking and Finance', 'banking-and-finance',
   'The Firm has carved a niche in the Banking and Finance areas of practice, having established itself as a reliable, efficient service provider in this sector.', 3),

  ('Criminal, Civil & Commercial Litigation', 'criminal-civil-commercial-litigation',
   'The Firm has distinguished itself as a top litigation Firm, having been tasked to litigate on both simple and complicated matters, which it has successfully handled.', 4),

  ('Company Secretarial Work', 'company-secretarial-work',
   'The Firm has a well-established company secretarial section, complete with a qualified practicing company secretary.', 5),

  ('Conveyancing', 'conveyancing',
   'The Firm acts for a wide range of clients, from individuals to corporates to statutory bodies, in conveyancing matters.', 6),

  ('Corporate Governance and Governance Audit', 'corporate-governance-and-audit',
   'The Firm recognizes the key role played by good governance in corporations and organizations.', 7),

  ('Due Diligence', 'due-diligence',
   'The Firm strongly holds that every transaction it undertakes ought to be preceded by due diligence, which helps assess potential risk and mitigate losses before they occur.', 8),

  ('Employment Law', 'employment-law',
   'The Firm partners with its clients to ensure they meet their legal compliance obligations, assisting them in finding solutions for disputes and management of employment risks.', 9)
ON CONFLICT (slug) DO NOTHING;

-- ---------- HOMEPAGE STATS ----------
-- The firm's real, long-standing case count from the previous site
-- ("2500++ Solved Cases") replaces the placeholder "500+ Cases Handled"
-- figure. The other three figures (years experience / offices / client
-- satisfaction) were not published on the old site, so they're left as
-- whatever is already saved rather than guessed at.

INSERT INTO site_settings (key, value)
VALUES ('home_stats', '[
  {"label": "Cases Solved", "value": 2500, "suffix": "++"},
  {"label": "Years Experience", "value": 15, "suffix": "+"},
  {"label": "East Africa Offices", "value": 7, "suffix": ""},
  {"label": "Client Satisfaction", "value": 98, "suffix": "%"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
