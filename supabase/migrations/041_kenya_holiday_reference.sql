-- Kenya public-holiday reference data. Date-specific declarations (notably
-- lunar holidays and special Gazette notices) are stored as overrides rather
-- than guessed by the calendar engine.
CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL DEFAULT 'KE',
  name TEXT NOT NULL,
  holiday_type TEXT NOT NULL CHECK (holiday_type IN ('PUBLIC','RELIGIOUS','OBSERVANCE','CONDITIONAL')),
  calculation_rule TEXT NOT NULL,
  month SMALLINT CHECK (month BETWEEN 1 AND 12),
  day SMALLINT CHECK (day BETWEEN 1 AND 31),
  faith_scope TEXT,
  is_non_working_day BOOLEAN NOT NULL DEFAULT TRUE,
  source_url TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, name)
);

CREATE TABLE IF NOT EXISTS public_holiday_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_id UUID REFERENCES public_holidays(id) ON DELETE SET NULL,
  country_code TEXT NOT NULL DEFAULT 'KE',
  observed_on DATE NOT NULL,
  name TEXT NOT NULL,
  is_non_working_day BOOLEAN NOT NULL DEFAULT TRUE,
  gazette_reference TEXT,
  source_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, observed_on, name)
);

INSERT INTO public_holidays (name, holiday_type, calculation_rule, month, day, faith_scope, is_non_working_day, source_url, notes)
VALUES
  ('New Year''s Day','PUBLIC','FIXED_DATE',1,1,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Observed on the next non-public-holiday weekday when it falls on Sunday.'),
  ('Good Friday','PUBLIC','WESTERN_EASTER_MINUS_2',NULL,NULL,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Easter Sunday','OBSERVANCE','WESTERN_EASTER',NULL,NULL,NULL,false,'https://www.kenyamycountry.com/web/national-holidays','Included as an observance from the supplied reference; it is not listed as a statutory non-working public holiday in the Public Holidays Act.'),
  ('Easter Monday','PUBLIC','WESTERN_EASTER_PLUS_1',NULL,NULL,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Labour Day','PUBLIC','FIXED_DATE',5,1,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Madaraka Day','PUBLIC','FIXED_DATE',6,1,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Idd-ul-Fitr','RELIGIOUS','GAZETTE_DECLARATION',NULL,NULL,'Islamic faith',true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Date depends on the appearance of the moon and Government Gazette declaration.'),
  ('Idd-ul-Azha','RELIGIOUS','GAZETTE_DECLARATION',NULL,NULL,'Islamic faith',true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Additional public holiday for persons of the Islamic faith.'),
  ('Mazingira Day','PUBLIC','FIXED_DATE',10,10,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Current statutory name and date.'),
  ('Mashujaa Day','PUBLIC','FIXED_DATE',10,20,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Formerly Kenyatta Day.'),
  ('Jamhuri Day','PUBLIC','FIXED_DATE',12,12,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Christmas Day','PUBLIC','FIXED_DATE',12,25,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Boxing Day','PUBLIC','FIXED_DATE',12,26,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21',NULL),
  ('Diwali','RELIGIOUS','GAZETTE_DECLARATION',NULL,NULL,'Hindu faith',true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Additional public holiday for persons of the Hindu faith.'),
  ('General Election Day','CONDITIONAL','GAZETTE_DECLARATION',NULL,NULL,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Applies in a year in which a general election is held following dissolution of Parliament.'),
  ('President-elect Swearing-in Day','CONDITIONAL','GAZETTE_DECLARATION',NULL,NULL,NULL,true,'https://new.kenyalaw.org/akn/ke/act/1912/21','Applies in a year in which a President-elect is sworn in.')
ON CONFLICT (country_code, name) DO UPDATE SET
  holiday_type=EXCLUDED.holiday_type, calculation_rule=EXCLUDED.calculation_rule, month=EXCLUDED.month, day=EXCLUDED.day,
  faith_scope=EXCLUDED.faith_scope, is_non_working_day=EXCLUDED.is_non_working_day, source_url=EXCLUDED.source_url, notes=EXCLUDED.notes, is_active=TRUE, updated_at=NOW();

CREATE INDEX IF NOT EXISTS idx_public_holidays_country_active ON public_holidays(country_code, is_active);
CREATE INDEX IF NOT EXISTS idx_public_holiday_overrides_date ON public_holiday_overrides(country_code, observed_on);
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holiday_overrides ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('manage_reference_data','Manage Reference Data','Operations','Maintain holidays and other controlled reference lists')
ON CONFLICT (key) DO NOTHING;
