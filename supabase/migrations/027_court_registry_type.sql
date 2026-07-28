-- ============================================================
-- COURT REGISTRY TYPE
--
-- Registry status (main registry vs sub-registry vs a named division
-- within one station) was previously buried as free text in `notes` for
-- Court of Appeal only, and entirely absent for every other court type.
-- This promotes it to a real column so it can be filtered on, rather than
-- parsed out of prose.
--
-- Backfill only claims what the source data actually supports:
--   - Court of Appeal: 'main' / 'sub' per the registry it was seeded under.
--     The two unconfirmed CoA entries (already is_active = false) stay
--     'unspecified' rather than guessed.
--   - Supreme Court: 'main' (it sits only in Nairobi, there is no other).
--   - High Court / ELC / ELRC: 'unspecified'. The source data
--     (kenya_court_registries.json) gave a flat station list for these
--     with no main/sub distinction, so there is nothing honest to backfill.
--   - Subordinate courts: 'division' where the station name itself encodes
--     one (e.g. "Milimani Commercial - Family & Divorce Div."), the only
--     place the source data broke a station into named divisions.
--     Everything else stays 'unspecified'.
-- ============================================================

ALTER TABLE courts ADD COLUMN registry_type TEXT NOT NULL DEFAULT 'unspecified'
  CHECK (registry_type IN ('main', 'sub', 'division', 'unspecified'));

UPDATE courts SET registry_type = 'main'
WHERE court_type = 'supreme';

UPDATE courts SET registry_type = 'main'
WHERE court_type = 'court_of_appeal' AND notes = 'Main registry.';

UPDATE courts SET registry_type = 'sub'
WHERE court_type = 'court_of_appeal' AND notes = 'Sub-registry.';

UPDATE courts SET registry_type = 'division'
WHERE is_superior = false AND name LIKE '% - %';
