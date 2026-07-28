-- ============================================================
-- ANALYTICS
-- ============================================================
-- Two lightweight logs. Blog "popular articles" already has a running
-- total via blog_posts.views (from an earlier pass), this adds
-- time-scoped page views generally, plus what visitors are asking the
-- public chat widget, which is the closest real signal this site has
-- to "search terms" (there's no public search bar to log queries from).

CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path TEXT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_chat_queries_created_at ON chat_queries(created_at);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_queries ENABLE ROW LEVEL SECURITY;
