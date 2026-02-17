CREATE TABLE review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_tokens_token ON review_tokens(token);
CREATE INDEX idx_review_tokens_session ON review_tokens(job_session_id);

-- Enable RLS
ALTER TABLE review_tokens ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access" ON review_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Public can read by token (for the no-auth review page)
CREATE POLICY "Public can read by token" ON review_tokens
  FOR SELECT USING (true);
