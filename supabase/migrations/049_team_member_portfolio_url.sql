-- Optional external portfolio for a public team profile. Empty values remain
-- absent from the public cards, so no placeholder action is ever rendered.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
