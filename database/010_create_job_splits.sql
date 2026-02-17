-- =============================================
-- 010: JOB SPLITS
-- =============================================
-- Allows two employees to share a job session.
-- Both must independently confirm completion.

-- 1. job_splits table: request tracking with 2-phase approval
CREATE TABLE IF NOT EXISTS job_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING_PARTNER'
    CHECK (status IN ('PENDING_PARTNER', 'PENDING_EMPLOYER', 'APPROVED', 'DENIED_PARTNER', 'DENIED_EMPLOYER', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

-- Only one active split per session (PENDING_PARTNER, PENDING_EMPLOYER, or APPROVED)
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_splits_active_per_session
  ON job_splits (job_session_id)
  WHERE status IN ('PENDING_PARTNER', 'PENDING_EMPLOYER', 'APPROVED');

-- 2. Add split_with column to job_sessions
ALTER TABLE job_sessions
  ADD COLUMN IF NOT EXISTS split_with UUID REFERENCES employees(id);

-- 3. job_split_confirmations table: tracks each employee's completion confirmation
CREATE TABLE IF NOT EXISTS job_split_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_session_id, employee_id)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE job_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_split_confirmations ENABLE ROW LEVEL SECURITY;

-- job_splits: employees can see splits they are part of
CREATE POLICY "Employees can view own splits"
  ON job_splits FOR SELECT
  USING (
    requested_by IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR partner_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- job_splits: employers can see all splits for their employees
CREATE POLICY "Employers can view all splits"
  ON job_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employers WHERE user_id = auth.uid()
    )
  );

-- job_splits: employees can create split requests
CREATE POLICY "Employees can create splits"
  ON job_splits FOR INSERT
  WITH CHECK (
    requested_by IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- job_splits: employees can update splits they are part of (accept/decline)
CREATE POLICY "Employees can update own splits"
  ON job_splits FOR UPDATE
  USING (
    requested_by IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR partner_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- job_splits: employers can update splits (approve/deny)
CREATE POLICY "Employers can update splits"
  ON job_splits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employers WHERE user_id = auth.uid()
    )
  );

-- job_split_confirmations: employees can see confirmations for their sessions
CREATE POLICY "Employees can view split confirmations"
  ON job_split_confirmations FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR job_session_id IN (
      SELECT js.id FROM job_sessions js
      JOIN employees e ON (e.id = js.assigned_to OR e.id = js.split_with)
      WHERE e.user_id = auth.uid()
    )
  );

-- job_split_confirmations: employers can see all
CREATE POLICY "Employers can view split confirmations"
  ON job_split_confirmations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employers WHERE user_id = auth.uid()
    )
  );

-- job_split_confirmations: employees can insert their own confirmations
CREATE POLICY "Employees can create split confirmations"
  ON job_split_confirmations FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- job_sessions: split partner can read the session via split_with
CREATE POLICY "Split partner can view session"
  ON job_sessions FOR SELECT
  USING (
    split_with IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );
