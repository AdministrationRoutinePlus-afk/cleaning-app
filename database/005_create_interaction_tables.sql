-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 5: Interaction Tables (4 tables)
-- =============================================

-- 1. EVALUATIONS (Customer reviews)
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_session_id)
);

-- 2. STRIKES (Issues logged)
CREATE TABLE strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type strike_target_type NOT NULL,
  target_id UUID NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  severity strike_severity DEFAULT 'MINOR',
  created_by UUID NOT NULL REFERENCES employers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. JOB EXCHANGES
CREATE TABLE job_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  from_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reason TEXT,
  status exchange_status DEFAULT 'PENDING',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES employers(id)
);

-- 4. NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for interaction tables
CREATE INDEX idx_evaluations_session ON evaluations(job_session_id);
CREATE INDEX idx_evaluations_customer ON evaluations(customer_id);
CREATE INDEX idx_evaluations_employee ON evaluations(employee_id);
CREATE INDEX idx_strikes_target ON strikes(target_type, target_id);
CREATE INDEX idx_strikes_created_by ON strikes(created_by);
CREATE INDEX idx_job_exchanges_session ON job_exchanges(job_session_id);
CREATE INDEX idx_job_exchanges_from ON job_exchanges(from_employee_id);
CREATE INDEX idx_job_exchanges_to ON job_exchanges(to_employee_id);
CREATE INDEX idx_job_exchanges_status ON job_exchanges(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at);
