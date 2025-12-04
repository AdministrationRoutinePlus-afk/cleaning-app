-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 3: Job Tables (7 tables)
-- =============================================

-- 1. JOB TEMPLATES
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code VARCHAR(3) NOT NULL,
  template_number VARCHAR(2) NOT NULL,
  version_letter VARCHAR(1) NOT NULL DEFAULT 'A',
  job_code VARCHAR(12) GENERATED ALWAYS AS (client_code || '-' || template_number || version_letter) STORED,
  title TEXT NOT NULL,
  description TEXT,
  address TEXT,
  duration_minutes INTEGER,
  price_per_hour DECIMAL(10,2),
  notes TEXT,
  timezone TEXT DEFAULT 'America/Toronto',
  available_days JSONB DEFAULT '["MON","TUE","WED","THU","FRI"]'::jsonb,
  time_window_start TIME,
  time_window_end TIME,
  is_recurring BOOLEAN DEFAULT FALSE,
  frequency_per_week INTEGER,
  status job_template_status DEFAULT 'DRAFT',
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES employers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. JOB STEPS
CREATE TABLE job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  products_needed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_template_id, step_order)
);

-- 3. JOB STEP IMAGES
CREATE TABLE job_step_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_step_id UUID NOT NULL REFERENCES job_steps(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER DEFAULT 1,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. JOB STEP CHECKLIST
CREATE TABLE job_step_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_step_id UUID NOT NULL REFERENCES job_steps(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  item_order INTEGER NOT NULL,
  UNIQUE(job_step_id, item_order)
);

-- 5. JOB SESSIONS
CREATE TABLE job_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
  session_code VARCHAR(5) NOT NULL,
  full_job_code VARCHAR(18),
  scheduled_date DATE,
  scheduled_time TIME,
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  status job_session_status DEFAULT 'OFFERED',
  price_override DECIMAL(10,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. JOB SESSION PROGRESS
CREATE TABLE job_session_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  job_step_id UUID NOT NULL REFERENCES job_steps(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(job_session_id, job_step_id)
);

-- 7. JOB SESSION CHECKLIST PROGRESS
CREATE TABLE job_session_checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES job_step_checklist(id) ON DELETE CASCADE,
  is_checked BOOLEAN DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  UNIQUE(job_session_id, checklist_item_id)
);

-- Indexes for job tables
CREATE INDEX idx_job_templates_created_by ON job_templates(created_by);
CREATE INDEX idx_job_templates_customer_id ON job_templates(customer_id);
CREATE INDEX idx_job_templates_status ON job_templates(status);
CREATE INDEX idx_job_templates_job_code ON job_templates(job_code);
CREATE INDEX idx_job_steps_template ON job_steps(job_template_id);
CREATE INDEX idx_job_step_images_step ON job_step_images(job_step_id);
CREATE INDEX idx_job_step_checklist_step ON job_step_checklist(job_step_id);
CREATE INDEX idx_job_sessions_template ON job_sessions(job_template_id);
CREATE INDEX idx_job_sessions_assigned ON job_sessions(assigned_to);
CREATE INDEX idx_job_sessions_status ON job_sessions(status);
CREATE INDEX idx_job_sessions_date ON job_sessions(scheduled_date);
CREATE INDEX idx_job_session_progress_session ON job_session_progress(job_session_id);
CREATE INDEX idx_job_session_checklist_progress_session ON job_session_checklist_progress(job_session_id);
