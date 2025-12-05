-- Fix Job Templates RLS Policies
-- This ensures employers can view their job templates

-- First drop any conflicting policies
DROP POLICY IF EXISTS "Employers can view own job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can create job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can update job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can delete job templates" ON job_templates;
DROP POLICY IF EXISTS "Employees can view active jobs" ON job_templates;
DROP POLICY IF EXISTS "Customers can view their job templates" ON job_templates;

-- Enable RLS (in case it was disabled)
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;

-- Recreate policies for job_templates

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

-- Verification query (run this manually to check):
-- SELECT * FROM job_templates;
