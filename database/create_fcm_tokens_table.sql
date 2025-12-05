-- Create FCM Tokens table for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "fcm_tokens_select" ON fcm_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_insert" ON fcm_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_update" ON fcm_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_delete" ON fcm_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
