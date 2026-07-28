-- ============================================================
-- TIME LOGGING + INVOICING
-- ============================================================
-- Time entries and invoices belong to a matter, not to standalone tools:
-- work is logged against the matter it was done for, and an invoice is
-- generated from that matter's unbilled time, no re-typing amounts into
-- a separate billing module.
--
-- Money is stored in KES. VAT defaults to Kenya's standard 16% on legal
-- services; client_kra_pin exists because invoices to Kenyan businesses
-- carry the client's KRA PIN.

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  matter_id UUID REFERENCES legal_matters(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_kra_pin TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
  -- [{ description, amount }], snapshot at generation time, so later edits
  -- to time entries never silently change an issued invoice.
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 16,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_invoices_matter ON invoices(matter_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  rate NUMERIC(12,2) NOT NULL DEFAULT 0, -- hourly rate in KES
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  -- Set when the entry is swept into an invoice; a billed entry is frozen.
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_time_entries_matter ON time_entries(matter_id);
CREATE INDEX idx_time_entries_invoice ON time_entries(invoice_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
-- No policies, all access via the API with the service-role client,
-- same convention as the rest of the schema.

INSERT INTO permissions (key, label, category, description) VALUES
  ('log_time', 'Log Time', 'Legal', 'Record time entries against legal matters'),
  ('manage_billing', 'Manage Billing', 'Legal', 'Generate, send, and settle invoices')
ON CONFLICT (key) DO NOTHING;
