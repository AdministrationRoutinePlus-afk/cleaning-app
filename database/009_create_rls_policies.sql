-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 9: Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
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
-- EMPLOYER POLICIES
-- =============================================

-- Employers can read/update their own record
CREATE POLICY "Employers can view own profile"
ON employers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Employers can update own profile"
ON employers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Employers can insert own profile"
ON employers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =============================================
-- EMPLOYEE POLICIES
-- =============================================

-- Employees can view their own profile
CREATE POLICY "Employees can view own profile"
ON employees FOR SELECT
USING (auth.uid() = user_id);

-- Employees can update their own profile
CREATE POLICY "Employees can update own profile"
ON employees FOR UPDATE
USING (auth.uid() = user_id);

-- Employees can insert (register)
CREATE POLICY "Anyone can register as employee"
ON employees FOR INSERT
WITH CHECK (true);

-- Employers can view all employees
CREATE POLICY "Employers can view all employees"
ON employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employers WHERE user_id = auth.uid()
  )
);

-- Employers can update employees (activate, deactivate, etc.)
CREATE POLICY "Employers can update employees"
ON employees FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM employers WHERE user_id = auth.uid()
  )
);

-- =============================================
-- CUSTOMER POLICIES
-- =============================================

-- Customers can view their own profile
CREATE POLICY "Customers can view own profile"
ON customers FOR SELECT
USING (auth.uid() = user_id);

-- Employers can view all their customers
CREATE POLICY "Employers can view their customers"
ON customers FOR SELECT
USING (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- Employers can create customers
CREATE POLICY "Employers can create customers"
ON customers FOR INSERT
WITH CHECK (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- Employers can update their customers
CREATE POLICY "Employers can update their customers"
ON customers FOR UPDATE
USING (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- =============================================
-- COMPANY INFO POLICIES
-- =============================================

CREATE POLICY "Employers can view own company info"
ON company_info FOR SELECT
USING (
  employer_id IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employers can insert company info"
ON company_info FOR INSERT
WITH CHECK (
  employer_id IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Employers can update company info"
ON company_info FOR UPDATE
USING (
  employer_id IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- =============================================
-- JOB TEMPLATE POLICIES
-- =============================================

-- Employers can view their own job templates
CREATE POLICY "Employers can view own job templates"
ON job_templates FOR SELECT
USING (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- Employees can view active job templates (marketplace)
CREATE POLICY "Employees can view active jobs"
ON job_templates FOR SELECT
USING (
  status = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'
  )
);

-- Customers can view their linked job templates
CREATE POLICY "Customers can view their job templates"
ON job_templates FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Employers can create job templates
CREATE POLICY "Employers can create job templates"
ON job_templates FOR INSERT
WITH CHECK (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- Employers can update their job templates
CREATE POLICY "Employers can update job templates"
ON job_templates FOR UPDATE
USING (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- Employers can delete their job templates
CREATE POLICY "Employers can delete job templates"
ON job_templates FOR DELETE
USING (
  created_by IN (
    SELECT id FROM employers WHERE user_id = auth.uid()
  )
);

-- =============================================
-- JOB STEPS POLICIES
-- =============================================

-- View steps if can view template
CREATE POLICY "Users can view job steps"
ON job_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    WHERE jt.id = job_template_id
    AND (
      -- Employer owns it
      jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
      -- Or employee can see active jobs
      OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
      -- Or customer owns the linked customer
      OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    )
  )
);

-- Employers can manage job steps
CREATE POLICY "Employers can insert job steps"
ON job_steps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN employers e ON jt.created_by = e.id
    WHERE jt.id = job_template_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Employers can update job steps"
ON job_steps FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN employers e ON jt.created_by = e.id
    WHERE jt.id = job_template_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Employers can delete job steps"
ON job_steps FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN employers e ON jt.created_by = e.id
    WHERE jt.id = job_template_id AND e.user_id = auth.uid()
  )
);

-- =============================================
-- JOB STEP IMAGES POLICIES
-- =============================================

CREATE POLICY "Users can view job step images"
ON job_step_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_steps js
    JOIN job_templates jt ON js.job_template_id = jt.id
    WHERE js.id = job_step_id
    AND (
      jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
      OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
      OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Employers can manage job step images"
ON job_step_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_steps js
    JOIN job_templates jt ON js.job_template_id = jt.id
    JOIN employers e ON jt.created_by = e.id
    WHERE js.id = job_step_id AND e.user_id = auth.uid()
  )
);

-- =============================================
-- JOB STEP CHECKLIST POLICIES
-- =============================================

CREATE POLICY "Users can view job step checklist"
ON job_step_checklist FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_steps js
    JOIN job_templates jt ON js.job_template_id = jt.id
    WHERE js.id = job_step_id
    AND (
      jt.created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
      OR (jt.status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'))
      OR jt.customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Employers can manage job step checklist"
ON job_step_checklist FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_steps js
    JOIN job_templates jt ON js.job_template_id = jt.id
    JOIN employers e ON jt.created_by = e.id
    WHERE js.id = job_step_id AND e.user_id = auth.uid()
  )
);

-- =============================================
-- JOB SESSIONS POLICIES
-- =============================================

-- Employers can view all their job sessions
CREATE POLICY "Employers can view their job sessions"
ON job_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN employers e ON jt.created_by = e.id
    WHERE jt.id = job_template_id AND e.user_id = auth.uid()
  )
);

-- Employees can view offered jobs and their assigned jobs
CREATE POLICY "Employees can view marketplace and assigned sessions"
ON job_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'
  )
  AND (
    status = 'OFFERED'
    OR assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
  )
);

-- Customers can view sessions for their jobs
CREATE POLICY "Customers can view their job sessions"
ON job_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN customers c ON jt.customer_id = c.id
    WHERE jt.id = job_template_id AND c.user_id = auth.uid()
  )
);

-- Employers can create/update/delete sessions
CREATE POLICY "Employers can manage job sessions"
ON job_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN employers e ON jt.created_by = e.id
    WHERE jt.id = job_template_id AND e.user_id = auth.uid()
  )
);

-- Employees can update their assigned sessions (start, complete, etc.)
CREATE POLICY "Employees can update their sessions"
ON job_sessions FOR UPDATE
USING (
  assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- =============================================
-- JOB SESSION PROGRESS POLICIES
-- =============================================

CREATE POLICY "Users can view session progress"
ON job_session_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_sessions js
    WHERE js.id = job_session_id
    AND (
      -- Employer
      EXISTS (
        SELECT 1 FROM job_templates jt
        JOIN employers e ON jt.created_by = e.id
        WHERE jt.id = js.job_template_id AND e.user_id = auth.uid()
      )
      -- Or assigned employee
      OR js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Employees can update their session progress"
ON job_session_progress FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_sessions js
    WHERE js.id = job_session_id
    AND js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
  )
);

-- =============================================
-- JOB SESSION CHECKLIST PROGRESS POLICIES
-- =============================================

CREATE POLICY "Users can view checklist progress"
ON job_session_checklist_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_sessions js
    WHERE js.id = job_session_id
    AND (
      EXISTS (
        SELECT 1 FROM job_templates jt
        JOIN employers e ON jt.created_by = e.id
        WHERE jt.id = js.job_template_id AND e.user_id = auth.uid()
      )
      OR js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Employees can update their checklist progress"
ON job_session_checklist_progress FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM job_sessions js
    WHERE js.id = job_session_id
    AND js.assigned_to IN (SELECT id FROM employees WHERE user_id = auth.uid())
  )
);

-- =============================================
-- CONVERSATION POLICIES
-- =============================================

CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
USING (
  id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- =============================================
-- CONVERSATION PARTICIPANTS POLICIES
-- =============================================

CREATE POLICY "Users can view participants in their conversations"
ON conversation_participants FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can add participants"
ON conversation_participants FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE created_by = auth.uid()
  )
);

-- =============================================
-- MESSAGES POLICIES
-- =============================================

CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  )
);

-- =============================================
-- SCHEDULE MESSAGES POLICIES
-- =============================================

CREATE POLICY "Employers can view all schedule messages"
ON schedule_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employees can view their schedule messages"
ON schedule_messages FOR SELECT
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can create schedule messages"
ON schedule_messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

-- =============================================
-- EVALUATIONS POLICIES
-- =============================================

CREATE POLICY "Employers can view all evaluations"
ON evaluations FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employees can view their evaluations"
ON evaluations FOR SELECT
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Customers can view and create their evaluations"
ON evaluations FOR SELECT
USING (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);

CREATE POLICY "Customers can submit evaluations"
ON evaluations FOR INSERT
WITH CHECK (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);

CREATE POLICY "Customers can update their evaluations"
ON evaluations FOR UPDATE
USING (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);

-- =============================================
-- STRIKES POLICIES
-- =============================================

CREATE POLICY "Employers can manage strikes"
ON strikes FOR ALL
USING (
  created_by IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

-- =============================================
-- JOB EXCHANGES POLICIES
-- =============================================

CREATE POLICY "Employers can view all exchanges"
ON job_exchanges FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can update exchanges"
ON job_exchanges FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employees can view their exchanges"
ON job_exchanges FOR SELECT
USING (
  from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  OR to_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Employees can create exchanges"
ON job_exchanges FOR INSERT
WITH CHECK (
  from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Employees can update their exchanges"
ON job_exchanges FOR UPDATE
USING (
  from_employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

CREATE POLICY "Users can view their notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow system to insert notifications
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- =============================================
-- EMPLOYER SETTINGS POLICIES
-- =============================================

CREATE POLICY "Employers can manage their settings"
ON employer_settings FOR ALL
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

-- =============================================
-- NOTIFICATION SETTINGS POLICIES
-- =============================================

CREATE POLICY "Users can manage their notification settings"
ON notification_settings FOR ALL
USING (auth.uid() = user_id);

-- =============================================
-- REMINDER SETTINGS POLICIES
-- =============================================

CREATE POLICY "Employers can manage reminder settings"
ON reminder_settings FOR ALL
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

-- =============================================
-- EMPLOYEE AVAILABILITY POLICIES
-- =============================================

CREATE POLICY "Employees can manage their availability"
ON employee_availability FOR ALL
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can view employee availability"
ON employee_availability FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

-- =============================================
-- EMPLOYEE AVAILABILITY DATES POLICIES
-- =============================================

CREATE POLICY "Employees can manage their availability dates"
ON employee_availability_dates FOR ALL
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can view employee availability dates"
ON employee_availability_dates FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);
