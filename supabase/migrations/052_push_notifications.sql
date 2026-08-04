-- ============================================================
-- PUSH NOTIFICATIONS
--
-- One browser/device subscription per row. A person can hold several (a
-- phone, a laptop, both installed), each with its own endpoint and keys,
-- so a push goes out to every device they've opted in on, not just the
-- last one.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions(profile_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('send_push_notifications', 'Send Push Notifications', 'Communications', 'Send a push notification to a specific person or broadcast to a role')
ON CONFLICT (key) DO NOTHING;
