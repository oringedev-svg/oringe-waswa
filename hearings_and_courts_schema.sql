-- ============================================================
-- KNOWLEDGE HUB LAYER: Courts → Divisions → Judges
-- ============================================================
-- `courts` already exists in your schema with public_read policy.
-- This adds the two levels beneath it.

CREATE TABLE court_divisions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id         uuid NOT NULL REFERENCES firms(id),
    court_id        uuid NOT NULL REFERENCES courts(id),
    name            text NOT NULL,               -- e.g. "Commercial Division"
    description     text,
    is_active       boolean NOT NULL DEFAULT true,
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (court_id, name)
);

CREATE TABLE judges (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id             uuid NOT NULL REFERENCES firms(id),
    court_division_id   uuid NOT NULL REFERENCES court_divisions(id),
    full_name           text NOT NULL,            -- "Justice Tuiyott"
    title               text,                     -- "Justice", "Chief Magistrate"
    notes               text,                     -- free-text institutional knowledge
    -- structured knowledge fields the AI can query directly
    filing_preferences  jsonb DEFAULT '{}'::jsonb, -- e.g. {"bundles":"electronic","requires_courtesy_copy":true}
    is_active           boolean NOT NULL DEFAULT true,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (court_division_id, full_name)
);

-- Registry contacts and filing requirements per court/division —
-- referenced by the doc explicitly as Knowledge Hub content.
CREATE TABLE registry_contacts (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id             uuid NOT NULL REFERENCES firms(id),
    court_id            uuid NOT NULL REFERENCES courts(id),
    court_division_id   uuid REFERENCES court_divisions(id), -- nullable: some contacts are court-wide
    name                text NOT NULL,
    role                text,                     -- "Deputy Registrar", "Filing Clerk"
    phone               text,
    email                text,
    office_hours         text,
    notes                text,
    deleted_at           timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE filing_requirements (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id             uuid NOT NULL REFERENCES firms(id),
    court_id            uuid NOT NULL REFERENCES courts(id),
    court_division_id   uuid REFERENCES court_divisions(id),
    title               text NOT NULL,            -- "Electronic bundle required"
    description         text,
    applies_to          text,                     -- freeform: "civil suits", "commercial matters"
    source_url          text,                     -- link to practice direction / rule
    effective_date       date,
    deleted_at           timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RECORD LAYER: Hearings
-- ============================================================
-- First-class entity. calendar_events references this table
-- (one hearing -> one calendar event as a *view*, not the source of truth).

CREATE TABLE hearings (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id             uuid NOT NULL REFERENCES firms(id),
    matter_id           uuid NOT NULL REFERENCES legal_matters(id),

    -- Knowledge Hub links (cascading: court -> division -> judge)
    court_id            uuid NOT NULL REFERENCES courts(id),
    court_division_id   uuid REFERENCES court_divisions(id),
    judge_id            uuid REFERENCES judges(id),
    courtroom           text,

    -- Core hearing facts
    hearing_date         date NOT NULL,
    hearing_time          time,
    purpose               text NOT NULL,           -- "Mention", "Hearing", "Ruling", "Pre-trial conference"
    status                text NOT NULL DEFAULT 'scheduled'
                            CHECK (status IN ('scheduled','held','adjourned','vacated','cancelled')),

    -- Outcome (populated after the hearing happens)
    outcome               text,                    -- freeform summary
    orders_made            text,
    adjournment_reason      text,
    next_hearing_date        date,

    -- Attendance
    attendees_summary        text,                  -- or normalize into hearing_attendees if needed later

    -- Linkage
    recording_url           text,

    -- Audit / provenance — WHICH activity created/updated this record
    source_activity_id      uuid REFERENCES activities(id),

    deleted_at               timestamptz,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hearings_matter_id ON hearings(matter_id);
CREATE INDEX idx_hearings_date ON hearings(hearing_date);
CREATE INDEX idx_hearings_judge_id ON hearings(judge_id);

-- Documents filed at a specific hearing — junction, not a new document concept.
-- Reuses legal_documents; this just links doc <-> hearing.
CREATE TABLE hearing_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id         uuid NOT NULL REFERENCES firms(id),
    hearing_id      uuid NOT NULL REFERENCES hearings(id),
    document_id     uuid NOT NULL REFERENCES legal_documents(id),
    filed_at        timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (hearing_id, document_id)
);

-- calendar_events becomes a VIEW/projection of hearings, not a separate source of truth.
-- If calendar_events already exists as its own table, add a nullable FK so a hearing
-- can *optionally* materialize a calendar entry, rather than the reverse:
ALTER TABLE calendar_events
    ADD COLUMN hearing_id uuid REFERENCES hearings(id);

-- ============================================================
-- RLS — matches your existing firm_isolation pattern exactly
-- ============================================================

ALTER TABLE court_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_documents ENABLE ROW LEVEL SECURITY;

-- Knowledge Hub tables: public_read (like courts, practice_areas, coverage_areas)
-- because reference/institutional knowledge is useful pre-auth (e.g. marketing site,
-- "which courts do you cover" pages) — mirrors your existing courts policy.
CREATE POLICY public_read ON court_divisions
    FOR SELECT TO public
    USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY firm_isolation ON court_divisions
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

CREATE POLICY public_read ON judges
    FOR SELECT TO public
    USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY firm_isolation ON judges
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

CREATE POLICY firm_isolation ON registry_contacts
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

CREATE POLICY firm_isolation ON filing_requirements
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

-- Hearings and hearing_documents are Record-layer, internal only —
-- no public_read, matches legal_matters / legal_documents pattern.
CREATE POLICY firm_isolation ON hearings
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

CREATE POLICY firm_isolation ON hearing_documents
    FOR ALL TO public
    USING (firm_id = current_firm_id())
    WITH CHECK (firm_id = current_firm_id());

-- ============================================================
-- THE PATTERN THIS PROVES: one activity, five systems updated
-- ============================================================
-- Activity "Schedule Hearing" should, in one transaction:
--   1. INSERT INTO hearings (...)
--   2. INSERT/UPDATE calendar_events (via hearing_id link)         -> Calendar
--   3. INSERT INTO matter_stage_history (...)                       -> Timeline
--   4. INSERT INTO domain_events (event_type='hearing.scheduled')   -> Engines/AI
--   5. matter record's "next hearing" field is DERIVED (a query),
--      not stored redundantly, so there's no dual-write to keep in sync.
--
-- Once this works end-to-end for one activity, the same shape
-- (activity -> record tables -> domain_events) is the template
-- for Legal Issues, Evidence metadata, and every other Record section.
