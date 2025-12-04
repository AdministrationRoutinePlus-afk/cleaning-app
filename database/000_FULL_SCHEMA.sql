-- =============================================
-- CLEANING APP - COMPLETE DATABASE SCHEMA
-- =============================================
-- Run this entire file in Supabase SQL Editor
-- Total: 24 Tables + 11 Enums + 2 Storage Buckets
-- =============================================

-- =============================================
-- PART 1: ENUM TYPES (11 enums)
-- =============================================

-- Job Template Status
CREATE TYPE job_template_status AS ENUM ('DRAFT', 'ACTIVE');

-- Job Session Status
CREATE TYPE job_session_status AS ENUM (
  'OFFERED',      -- Posted to marketplace, waiting for employee
  'CLAIMED',      -- Employee picked it, waiting approval
  'APPROVED',     -- Employer approved, scheduled
  'IN_PROGRESS',  -- Employee working on it
  'COMPLETED',    -- Job finished
  'EVALUATED',    -- Customer submitted rating
  'CANCELLED'     -- Session cancelled
);

-- Employee Status
CREATE TYPE employee_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- Customer Status
CREATE TYPE customer_status AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- Exchange Status
CREATE TYPE exchange_status AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- Strike Severity
CREATE TYPE strike_severity AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- Strike Target Type
CREATE TYPE strike_target_type AS ENUM ('CUSTOMER', 'EMPLOYEE');

-- Conversation Type
CREATE TYPE conversation_type AS ENUM ('DIRECT', 'ANNOUNCEMENT', 'EMPLOYEE_GROUP');

-- User Type (for notifications)
CREATE TYPE user_type AS ENUM ('EMPLOYER', 'EMPLOYEE', 'CUSTOMER');

-- Day of Week
CREATE TYPE day_of_week AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- Theme
CREATE TYPE theme_type AS ENUM ('LIGHT', 'DARK');


-- =============================================
-- PART 2: USER TABLES (4 tables)
-- =============================================

-- 1. EMPLOYERS
CREATE TABLE employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- 2. EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  void_cheque_url TEXT,
  notes TEXT,
  status employee_status DEFAULT 'PENDING',
  created_by UUID REFERENCES employers(id),
  activated_by UUID REFERENCES employers(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- 3. CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code VARCHAR(3) NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status customer_status DEFAULT 'ACTIVE',
  created_by UUID NOT NULL REFERENCES employers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_code, created_by),
  UNIQUE(email)
);

-- 4. COMPANY INFO
CREATE TABLE company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  default_hourly_rate DECIMAL(10,2),
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);


-- =============================================
-- PART 3: JOB TABLES (7 tables)
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


-- =============================================
-- PART 4: MESSAGE TABLES (4 tables)
-- =============================================

-- 1. CONVERSATIONS
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type conversation_type NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONVERSATION PARTICIPANTS
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- 3. MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  job_session_id UUID REFERENCES job_sessions(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- 4. SCHEDULE MESSAGES
CREATE TABLE schedule_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- PART 5: INTERACTION TABLES (4 tables)
-- =============================================

-- 1. EVALUATIONS
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

-- 2. STRIKES
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


-- =============================================
-- PART 6: SETTINGS TABLES (3 tables)
-- =============================================

-- 1. EMPLOYER SETTINGS
CREATE TABLE employer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  theme theme_type DEFAULT 'LIGHT',
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  logo_url TEXT,
  language VARCHAR(5) DEFAULT 'en',
  push_enabled BOOLEAN DEFAULT TRUE,
  notify_new_message BOOLEAN DEFAULT TRUE,
  notify_job_claimed BOOLEAN DEFAULT TRUE,
  notify_exchange_request BOOLEAN DEFAULT TRUE,
  reminder_2_days BOOLEAN DEFAULT TRUE,
  reminder_1_day BOOLEAN DEFAULT TRUE,
  reminder_6_hours BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);

-- 2. NOTIFICATION SETTINGS
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, notification_type)
);

-- 3. REMINDER SETTINGS
CREATE TABLE reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  reminder_2_days BOOLEAN DEFAULT TRUE,
  reminder_1_day BOOLEAN DEFAULT TRUE,
  reminder_6_hours BOOLEAN DEFAULT TRUE,
  UNIQUE(employer_id)
);


-- =============================================
-- PART 7: AVAILABILITY TABLES (2 tables)
-- =============================================

-- 1. EMPLOYEE AVAILABILITY
CREATE TABLE employee_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  timezone TEXT DEFAULT 'America/Toronto',
  UNIQUE(employee_id, day_of_week)
);

-- 2. EMPLOYEE AVAILABILITY DATES
CREATE TABLE employee_availability_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  note TEXT,
  UNIQUE(employee_id, date)
);


-- =============================================
-- PART 8: INDEXES
-- =============================================

-- User table indexes
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_created_by ON employees(created_by);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_customers_customer_code ON customers(customer_code);

-- Job table indexes
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

-- Message table indexes
CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_schedule_messages_session ON schedule_messages(job_session_id);
CREATE INDEX idx_schedule_messages_employee ON schedule_messages(employee_id);

-- Interaction table indexes
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

-- Settings table indexes
CREATE INDEX idx_employer_settings_employer ON employer_settings(employer_id);
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX idx_reminder_settings_employer ON reminder_settings(employer_id);

-- Availability table indexes
CREATE INDEX idx_employee_availability_employee ON employee_availability(employee_id);
CREATE INDEX idx_employee_availability_day ON employee_availability(day_of_week);
CREATE INDEX idx_employee_availability_dates_employee ON employee_availability_dates(employee_id);
CREATE INDEX idx_employee_availability_dates_date ON employee_availability_dates(date);


-- =============================================
-- PART 9: STORAGE BUCKETS
-- =============================================

-- 1. JOB IMAGES (Public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-images', 'job-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. EMPLOYEE DOCUMENTS (Private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;


-- =============================================
-- PART 10: ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_step_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_step_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_session_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_session_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_availability_dates ENABLE ROW LEVEL SECURITY;


-- =============================================
-- PART 11: ROW LEVEL SECURITY POLICIES
-- =============================================

-- EMPLOYER POLICIES
CREATE POLICY "Employers can view own profile" ON employers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Employers can update own profile" ON employers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Employers can insert own profile" ON employers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- EMPLOYEE POLICIES
CREATE POLICY "Employees can view own profile" ON employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Employees can update own profile" ON employees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can register as employee" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Employers can view all employees" ON employees FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can update employees" ON employees FOR UPDATE USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));

-- CUSTOMER POLICIES
CREATE POLICY "Customers can view own profile" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Employers can view their customers" ON customers FOR SELECT USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can create customers" ON customers FOR INSERT WITH CHECK (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can update their customers" ON customers FOR UPDATE USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- COMPANY INFO POLICIES
CREATE POLICY "Employers can view own company info" ON company_info FOR SELECT USING (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can insert company info" ON company_info FOR INSERT WITH CHECK (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can update company info" ON company_info FOR UPDATE USING (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- JOB TEMPLATE POLICIES
CREATE POLICY "Employers can view own job templates" ON job_templates FOR SELECT USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view active jobs" ON job_templates FOR SELECT USING (status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'));
CREATE POLICY "Customers can view their job templates" ON job_templates FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can create job templates" ON job_templates FOR INSERT WITH CHECK (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can update job templates" ON job_templates FOR UPDATE USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can delete job templates" ON job_templates FOR DELETE USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- JOB STEPS POLICIES
CREATE POLICY "Users can view job steps" ON job_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_templates jt WHERE jt.id = job_template_id AND (
    jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
    OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
    OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  ))
);
CREATE POLICY "Employers can insert job steps" ON job_steps FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = job_template_id AND e.user_id = auth.uid()));
CREATE POLICY "Employers can update job steps" ON job_steps FOR UPDATE USING (EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = job_template_id AND e.user_id = auth.uid()));
CREATE POLICY "Employers can delete job steps" ON job_steps FOR DELETE USING (EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = job_template_id AND e.user_id = auth.uid()));

-- JOB STEP IMAGES & CHECKLIST POLICIES
CREATE POLICY "Users can view job step images" ON job_step_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_steps js JOIN job_templates jt ON js.job_template_id = jt.id WHERE js.id = job_step_id AND (
    jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
    OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
    OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  ))
);
CREATE POLICY "Employers can manage job step images" ON job_step_images FOR ALL USING (
  EXISTS (SELECT 1 FROM job_steps js JOIN job_templates jt ON js.job_template_id = jt.id JOIN employers e ON jt.created_by = e.id WHERE js.id = job_step_id AND e.user_id = auth.uid())
);

CREATE POLICY "Users can view job step checklist" ON job_step_checklist FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_steps js JOIN job_templates jt ON js.job_template_id = jt.id WHERE js.id = job_step_id AND (
    jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
    OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
    OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  ))
);
CREATE POLICY "Employers can manage job step checklist" ON job_step_checklist FOR ALL USING (
  EXISTS (SELECT 1 FROM job_steps js JOIN job_templates jt ON js.job_template_id = jt.id JOIN employers e ON jt.created_by = e.id WHERE js.id = job_step_id AND e.user_id = auth.uid())
);

-- JOB SESSIONS POLICIES
CREATE POLICY "Employers can view their job sessions" ON job_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = job_template_id AND e.user_id = auth.uid()));
CREATE POLICY "Employees can view marketplace and assigned sessions" ON job_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE') AND (status = 'OFFERED' OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())));
CREATE POLICY "Customers can view their job sessions" ON job_sessions FOR SELECT USING (EXISTS (SELECT 1 FROM job_templates jt JOIN customers c ON jt.customer_id = c.id WHERE jt.id = job_template_id AND c.user_id = auth.uid()));
CREATE POLICY "Employers can manage job sessions" ON job_sessions FOR ALL USING (EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = job_template_id AND e.user_id = auth.uid()));
CREATE POLICY "Employees can update their sessions" ON job_sessions FOR UPDATE USING (assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- JOB SESSION PROGRESS POLICIES
CREATE POLICY "Users can view session progress" ON job_session_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_sessions js WHERE js.id = job_session_id AND (
    EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = js.job_template_id AND e.user_id = auth.uid())
    OR js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
  ))
);
CREATE POLICY "Employees can update their session progress" ON job_session_progress FOR ALL USING (EXISTS (SELECT 1 FROM job_sessions js WHERE js.id = job_session_id AND js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())));

-- JOB SESSION CHECKLIST PROGRESS POLICIES
CREATE POLICY "Users can view checklist progress" ON job_session_checklist_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM job_sessions js WHERE js.id = job_session_id AND (
    EXISTS (SELECT 1 FROM job_templates jt JOIN employers e ON jt.created_by = e.id WHERE jt.id = js.job_template_id AND e.user_id = auth.uid())
    OR js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
  ))
);
CREATE POLICY "Employees can update their checklist progress" ON job_session_checklist_progress FOR ALL USING (EXISTS (SELECT 1 FROM job_sessions js WHERE js.id = job_session_id AND js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())));

-- CONVERSATION POLICIES
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT USING (id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = created_by);

-- CONVERSATION PARTICIPANTS POLICIES
CREATE POLICY "Users can view participants in their conversations" ON conversation_participants FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can add participants" ON conversation_participants FOR INSERT WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid()));

-- MESSAGES POLICIES
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "Users can send messages in their conversations" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()));

-- SCHEDULE MESSAGES POLICIES
CREATE POLICY "Employers can view all schedule messages" ON schedule_messages FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view their schedule messages" ON schedule_messages FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employers can create schedule messages" ON schedule_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));

-- EVALUATIONS POLICIES
CREATE POLICY "Employers can view all evaluations" ON evaluations FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view their evaluations" ON evaluations FOR SELECT USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Customers can view their evaluations" ON evaluations FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can submit evaluations" ON evaluations FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can update their evaluations" ON evaluations FOR UPDATE USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- STRIKES POLICIES
CREATE POLICY "Employers can manage strikes" ON strikes FOR ALL USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- JOB EXCHANGES POLICIES
CREATE POLICY "Employers can view all exchanges" ON job_exchanges FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employers can update exchanges" ON job_exchanges FOR UPDATE USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));
CREATE POLICY "Employees can view their exchanges" ON job_exchanges FOR SELECT USING (from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()) OR to_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can create exchanges" ON job_exchanges FOR INSERT WITH CHECK (from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can update their exchanges" ON job_exchanges FOR UPDATE USING (from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- EMPLOYER SETTINGS POLICIES
CREATE POLICY "Employers can manage their settings" ON employer_settings FOR ALL USING (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- NOTIFICATION SETTINGS POLICIES
CREATE POLICY "Users can manage their notification settings" ON notification_settings FOR ALL USING (auth.uid() = user_id);

-- REMINDER SETTINGS POLICIES
CREATE POLICY "Employers can manage reminder settings" ON reminder_settings FOR ALL USING (employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid()));

-- EMPLOYEE AVAILABILITY POLICIES
CREATE POLICY "Employees can manage their availability" ON employee_availability FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employers can view employee availability" ON employee_availability FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));

-- EMPLOYEE AVAILABILITY DATES POLICIES
CREATE POLICY "Employees can manage their availability dates" ON employee_availability_dates FOR ALL USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employers can view employee availability dates" ON employee_availability_dates FOR SELECT USING (EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid()));


-- =============================================
-- PART 12: STORAGE POLICIES
-- =============================================

-- Storage Policies for job-images bucket
CREATE POLICY "Public read access for job images" ON storage.objects FOR SELECT USING (bucket_id = 'job-images');
CREATE POLICY "Authenticated users can upload job images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update their own job images" ON storage.objects FOR UPDATE USING (bucket_id = 'job-images' AND auth.uid() = owner);
CREATE POLICY "Users can delete their own job images" ON storage.objects FOR DELETE USING (bucket_id = 'job-images' AND auth.uid() = owner);

-- Storage Policies for employee-documents bucket
CREATE POLICY "Employees can view their own documents" ON storage.objects FOR SELECT USING (bucket_id = 'employee-documents' AND auth.uid() = owner);
CREATE POLICY "Employees can upload their own documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Employees can update their own documents" ON storage.objects FOR UPDATE USING (bucket_id = 'employee-documents' AND auth.uid() = owner);
CREATE POLICY "Employees can delete their own documents" ON storage.objects FOR DELETE USING (bucket_id = 'employee-documents' AND auth.uid() = owner);


-- =============================================
-- SCHEMA COMPLETE!
-- =============================================
-- Total: 24 Tables, 11 Enums, 2 Storage Buckets
-- All RLS policies configured
-- All indexes created
-- =============================================
