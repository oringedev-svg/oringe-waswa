-- ============================================================
-- UNIFIED MESSAGING ENGINE
--
-- One messaging engine for the whole platform: direct messages, group
-- chats, practice-area channels, and matter conversations all share this
-- schema instead of each surface inventing its own thread table (the
-- previous team_messages sender/recipient pair could not express channels,
-- threading, or matter context at all).
--
-- Deliberately NOT used yet by assignment_messages, that table is live and
-- working; folding it into conversations (type='assignment') is a
-- follow-up migration once the unified engine has proven itself.
--
-- Messages are human communication, not system events, notifications stay
-- a separate concern (there is no notifications table here).
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'channel', 'matter')),
  title TEXT,
  -- Context anchors. Exactly one is relevant per type: channel ->
  -- practice_area_id, matter -> matter_id, direct/group -> neither
  -- (participants alone define the conversation).
  practice_area_id UUID REFERENCES practice_areas(id) ON DELETE CASCADE,
  matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (type <> 'channel' OR practice_area_id IS NOT NULL),
  CHECK (type <> 'matter' OR matter_id IS NOT NULL)
);

-- One channel per practice area, one conversation per matter: created on
-- first use rather than requiring a setup step, but never duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_channel_unique
  ON conversations(practice_area_id) WHERE type = 'channel';
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_matter_unique
  ON conversations(matter_id) WHERE type = 'matter';

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  -- Identity integrity (never spoof identity): actual_sender_id is always
  -- the authenticated caller. display_sender_id is only populated for an
  -- authorised delegated send (e.g. a PA sending for a partner), and never
  -- trusted from the client without delegation_approved_by being set in
  -- the same write.
  actual_sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  display_sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delegation_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delegation_approved_at TIMESTAMPTZ,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'system')),
  mentions UUID[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A delegated display identity is only meaningful with an audit trail
  -- attached; it can never be set unilaterally by the sender.
  CHECK (display_sender_id IS NULL OR delegation_approved_by IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, profile_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_conversations_matter ON conversations(matter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_profile ON conversation_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

INSERT INTO permissions (key, label, category, description) VALUES
  ('send_on_behalf', 'Send Messages On Behalf Of Others', 'Communications', 'Send a message under another team member''s display identity, with delegation recorded on every message')
ON CONFLICT (key) DO NOTHING;
