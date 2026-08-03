-- The editable courts register is the single court reference source used by
-- matters. These fields retain the non-overlapping operational detail that
-- was previously only present in the static Judiciary court dataset.
ALTER TABLE courts
  ADD COLUMN IF NOT EXISTS sub_county TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS services TEXT[] NOT NULL DEFAULT '{}';
