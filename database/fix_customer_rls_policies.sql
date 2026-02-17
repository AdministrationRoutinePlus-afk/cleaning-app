-- =============================================
-- Fix RLS policies for customer access
-- Run this in the Supabase Dashboard SQL Editor
-- =============================================

-- 1. Allow customers to read their employer's record (for chat)
DROP POLICY IF EXISTS "Customers can view their employer" ON employers;
CREATE POLICY "Customers can view their employer"
ON employers FOR SELECT
USING (
  id IN (
    SELECT created_by FROM customers WHERE user_id = auth.uid()
  )
);

-- 2. Ensure customers can view their job templates
DROP POLICY IF EXISTS "Customers can view their job templates" ON job_templates;
CREATE POLICY "Customers can view their job templates"
ON job_templates FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- 3. Ensure customers can view their job sessions
DROP POLICY IF EXISTS "Customers can view their job sessions" ON job_sessions;
CREATE POLICY "Customers can view their job sessions"
ON job_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN customers c ON jt.customer_id = c.id
    WHERE jt.id = job_template_id AND c.user_id = auth.uid()
  )
);

-- 4. Ensure customers can view employees (for review display)
DROP POLICY IF EXISTS "Customers can view employees" ON employees;
CREATE POLICY "Customers can view employees"
ON employees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM customers WHERE user_id = auth.uid()
  )
);

-- 5. Allow customers to update their job sessions (status → EVALUATED after review)
DROP POLICY IF EXISTS "Customers can update their job sessions" ON job_sessions;
CREATE POLICY "Customers can update their job sessions"
ON job_sessions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM job_templates jt
    JOIN customers c ON jt.customer_id = c.id
    WHERE jt.id = job_template_id AND c.user_id = auth.uid()
  )
);

-- 6. Allow customers to insert evaluations
DROP POLICY IF EXISTS "Customers can insert evaluations" ON evaluations;
CREATE POLICY "Customers can insert evaluations"
ON evaluations FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- 7. Allow customers to view their evaluations
DROP POLICY IF EXISTS "Customers can view their evaluations" ON evaluations;
CREATE POLICY "Customers can view their evaluations"
ON evaluations FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);
