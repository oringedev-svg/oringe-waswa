-- ============================================================
-- BILLING REFERENCE HUB
--
-- Centralized source of truth for work valuation. Every work type
-- (activity template) references this hub. Assignments inherit
-- values at creation time; overrides are tracked separately.
-- Billing begins when work is planned, not when invoiced.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,
  billing_method TEXT NOT NULL CHECK (billing_method IN ('Fixed','Hourly','Unit','Percentage','Custom')),
  default_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  vat_profile TEXT NOT NULL DEFAULT 'standard',
  tax_profile TEXT,
  estimated_hours INTEGER,
  estimated_duration_label TEXT,
  default_template_id UUID,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (firm_id, work_type)
);

-- Tracks when billing reference values are overridden on an assignment,
-- storing both the hub reference value and the actual applied value
CREATE TABLE IF NOT EXISTS billing_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  billing_reference_id UUID NOT NULL REFERENCES billing_references(id) ON DELETE SET NULL,
  reference_value DECIMAL(12,2) NOT NULL,
  override_value DECIMAL(12,2) NOT NULL,
  override_reason TEXT NOT NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns to activity_types to support billing references
ALTER TABLE activity_types
ADD COLUMN IF NOT EXISTS billing_reference_id UUID REFERENCES billing_references(id) ON DELETE SET NULL;

-- Add billing tracking to assignments
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS billing_reference_id UUID REFERENCES billing_references(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'NOT_PRICED'
  CHECK (billing_status IN ('NOT_PRICED','PRICED','APPROVED','SENT_TO_FINANCE','BILLED','WRITTEN_OFF'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_references_firm_active ON billing_references(firm_id, active);
CREATE INDEX IF NOT EXISTS idx_billing_overrides_assignment ON billing_overrides(assignment_id);
CREATE INDEX IF NOT EXISTS idx_billing_overrides_reference ON billing_overrides(billing_reference_id);
CREATE INDEX IF NOT EXISTS idx_assignments_billing_status ON assignments(matter_id, billing_status);

ALTER TABLE billing_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_overrides ENABLE ROW LEVEL SECURITY;

-- Add permission for managing billing references
INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_billing_references','Manage Billing References','Finance','Define work types, pricing, and valuation for billing automation')
ON CONFLICT (key) DO NOTHING;
