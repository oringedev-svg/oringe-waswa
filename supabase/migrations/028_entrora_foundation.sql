-- ============================================================
-- ENTRORA FOUNDATION
--
-- The shared infrastructure the Developer Handoff README says to build
-- before any capability: the domain event log, a separate security audit
-- log, firm-scoped row security (ADR-001), idempotency keys, and the
-- scope-aware authorization tables that CheckPermission resolves against.
--
-- This is deliberately ADDITIVE. Nothing existing is dropped or rewritten:
-- the current admin keeps working exactly as it does today while the
-- domain model is migrated onto these foundations capability by
-- capability (Matter + Client Journey first, per the README's order).
--
-- IMPORTANT, stated plainly rather than left implicit: the application
-- currently reads and writes through createAdminClient(), i.e. the
-- service-role key, which BYPASSES row-level security entirely. The RLS
-- policies below are therefore correct and enforced for any anon/authed
-- client, but they do not yet constrain the app itself. They become real
-- isolation the moment a request path moves to a user-scoped client, and
-- they are added now so that no table is ever created without them
-- (ADR-001: "from the first table onward").
-- ============================================================

-- ------------------------------------------------------------
-- 1. FIRM, the tenant root
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS firms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  jurisdiction TEXT DEFAULT 'KE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO firms (name, slug, jurisdiction)
VALUES ('Oringe Waswa & Akude Advocates LLP', 'oringe-waswa', 'KE')
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 2. DOMAIN EVENTS, the event log backbone
-- Architecture Principle 2: every business action emits an event, and
-- events are immutable once emitted. Immutability is enforced here by
-- rule, not left to convention.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  aggregate_id UUID NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor UUID,
  firm_id UUID NOT NULL REFERENCES firms(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_firm ON domain_events(firm_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(event_type);

-- Principle 2, enforced: an emitted event is a recorded fact. Correcting
-- history means emitting a compensating event, never editing or deleting
-- the original.
CREATE OR REPLACE RULE domain_events_no_update AS ON UPDATE TO domain_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE domain_events_no_delete AS ON DELETE TO domain_events DO INSTEAD NOTHING;

-- ------------------------------------------------------------
-- 3. SECURITY AUDIT, deliberately separate from domain_events
-- Authorization spec §5: authentication, permission changes and DENIED
-- attempts specifically, so a compliance review can find access-control
-- history without filtering every business event in the system.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID REFERENCES firms(id),
  event_type TEXT NOT NULL,          -- UserInvited.v1, RoleAssigned.v1, PermissionCheckDenied.v1 ...
  actor UUID,                         -- who attempted / performed it
  subject_user_id UUID,               -- who it was about, where different
  permission_key TEXT,
  scope_type TEXT,
  scope_id UUID,
  outcome TEXT NOT NULL DEFAULT 'allowed' CHECK (outcome IN ('allowed','denied')),
  detail JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_firm ON security_audit(firm_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_outcome ON security_audit(outcome, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON security_audit(actor, occurred_at DESC);

CREATE OR REPLACE RULE security_audit_no_update AS ON UPDATE TO security_audit DO INSTEAD NOTHING;
CREATE OR REPLACE RULE security_audit_no_delete AS ON DELETE TO security_audit DO INSTEAD NOTHING;

-- ------------------------------------------------------------
-- 4. IDEMPOTENCY KEYS for write endpoints
-- A duplicate request replays the stored response rather than performing
-- the action twice. Authorization §7 calls this out for RevokeRole and
-- RevokeDirectPermission in particular: a repeat revoke is a no-op that
-- returns the same result, not an error.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  firm_id UUID NOT NULL REFERENCES firms(id),
  endpoint TEXT NOT NULL,
  request_hash TEXT,
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (firm_id, key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

-- ------------------------------------------------------------
-- 5. AUTHORIZATION: scope-aware roles and grants
--
-- The existing flat `permissions` catalogue and `user_permissions` table
-- stay exactly as they are (nothing here breaks the current admin). These
-- add what the spec requires and the current model has no way to express:
-- a SCOPE on every grant (I1), hierarchical/additive resolution (I2), and
-- direct grants that can only ever ADD to role-derived permissions (I4).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  description TEXT,
  -- Compliance-sensitive commands (I6) must resolve to a role, never to
  -- an individual override; roles flagged here are the ones allowed to
  -- carry them.
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (firm_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'firm'
    CHECK (scope_type IN ('firm','office','department','team','matter')),
  scope_id UUID,                      -- NULL means "the whole scope_type", e.g. firm-wide
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (role_id, permission_key, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,              -- auth.users id, matching profiles.user_id
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES firms(id),
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

-- I4: additive only. There is deliberately no "deny" column, because a
-- direct grant that could subtract would make a user's permissions
-- underivable from their roles and break auditability.
CREATE TABLE IF NOT EXISTS permission_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  firm_id UUID NOT NULL REFERENCES firms(id),
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'firm'
    CHECK (scope_type IN ('firm','office','department','team','matter')),
  scope_id UUID,
  granted_by UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, permission_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_grants_user ON permission_grants(user_id);

-- ------------------------------------------------------------
-- 6. FIRM SCOPING + RLS (ADR-001)
--
-- firm_id is added to every tenant-scoped table, backfilled to the single
-- existing firm, and made NOT NULL. Shared reference data is deliberately
-- excluded: the Kenyan courts register, the permission catalogue and the
-- court routing rules are national/system reference, not one firm's
-- property, and giving them a firm_id would mean re-seeding 327 courts
-- per firm for no gain.
-- ------------------------------------------------------------
-- profiles.firm_id has to exist before current_firm_id() can be defined,
-- since Postgres validates a SQL function body at creation time and the
-- policies created in the DO block below all call this function.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id);
UPDATE profiles SET firm_id = (SELECT id FROM firms WHERE slug = 'oringe-waswa') WHERE firm_id IS NULL;

CREATE OR REPLACE FUNCTION current_firm_id() RETURNS UUID AS $$
  SELECT firm_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DO $$
DECLARE
  t TEXT;
  default_firm UUID;
  excluded TEXT[] := ARRAY[
    'firms', 'domain_events', 'security_audit', 'idempotency_keys',
    'roles', 'role_permissions', 'user_roles', 'permission_grants',
    -- shared reference / system catalogues, intentionally not firm-scoped
    'permissions', 'courts', 'court_routing_rules', 'schema_migrations'
  ];
BEGIN
  SELECT id INTO default_firm FROM firms WHERE slug = 'oringe-waswa';

  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY(excluded))
  LOOP
    -- Add the column if this table does not already carry one.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'firm_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN firm_id UUID REFERENCES firms(id)', t);
    END IF;

    EXECUTE format('UPDATE public.%I SET firm_id = %L WHERE firm_id IS NULL', t, default_firm);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN firm_id SET DEFAULT %L', t, default_firm);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN firm_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(firm_id)', 'idx_' || t || '_firm_id', t);

    -- ADR-001: isolation enforced at the database layer, not only in code.
    --
    -- profiles is deliberately skipped: current_firm_id() resolves a firm
    -- BY READING profiles, so putting a policy on profiles that calls
    -- current_firm_id() makes the policy depend on itself. Table owners
    -- bypass RLS so it would likely not actually recurse, but "likely"
    -- is not a safe basis for the table every authentication check runs
    -- through. It keeps firm_id (so it is still scoped and joinable) and
    -- gets an explicit self-access policy below instead.
    IF t <> 'profiles' THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS firm_isolation ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY firm_isolation ON public.%I USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id())',
        t
      );
    END IF;
  END LOOP;
END $$;

-- profiles: a user can always read their own row (this is what
-- current_firm_id() and every session lookup depends on), and otherwise
-- only sees profiles in their own firm. Written directly against
-- auth.uid() rather than via current_firm_id() so it never depends on
-- itself.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self_or_firm ON profiles;
CREATE POLICY profiles_self_or_firm ON profiles
  USING (
    user_id = auth.uid()
    OR firm_id = (SELECT p.firm_id FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  );

-- The new foundation tables get the same treatment.
ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON domain_events;
CREATE POLICY firm_isolation ON domain_events USING (firm_id = current_firm_id());

ALTER TABLE security_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON security_audit;
CREATE POLICY firm_isolation ON security_audit USING (firm_id = current_firm_id());

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON roles;
CREATE POLICY firm_isolation ON roles USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON role_permissions;
CREATE POLICY firm_isolation ON role_permissions
  USING (EXISTS (SELECT 1 FROM roles r WHERE r.id = role_id AND r.firm_id = current_firm_id()));

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON user_roles;
CREATE POLICY firm_isolation ON user_roles USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

ALTER TABLE permission_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON permission_grants;
CREATE POLICY firm_isolation ON permission_grants USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS firm_isolation ON idempotency_keys;
CREATE POLICY firm_isolation ON idempotency_keys USING (firm_id = current_firm_id()) WITH CHECK (firm_id = current_firm_id());

-- ------------------------------------------------------------
-- 7. Seed the firm's roles from the roles the app already uses, so
-- CheckPermission has something real to resolve against on day one.
-- ------------------------------------------------------------
INSERT INTO roles (firm_id, name, description, is_system)
SELECT f.id, r.name, r.description, true
FROM firms f
CROSS JOIN (VALUES
  ('admin', 'Full administrative authority across the firm'),
  ('staff', 'Fee earners and professional staff'),
  ('moderator', 'Content review and approval'),
  ('pupil', 'Pupils in training, permissions granted explicitly'),
  ('admin_assistant', 'Administrative support, permissions granted explicitly')
) AS r(name, description)
WHERE f.slug = 'oringe-waswa'
ON CONFLICT (firm_id, name) DO NOTHING;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_authorization', 'Manage Roles & Permissions', 'Administration', 'Define roles, assign them, and grant scoped permission overrides')
ON CONFLICT (key) DO NOTHING;
