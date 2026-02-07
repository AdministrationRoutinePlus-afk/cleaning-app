-- Allow employees to view customer data for jobs in the marketplace or assigned to them
-- This is needed so employees can see customer names on job cards

CREATE POLICY "Employees can view customers for available jobs"
ON customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid()
  )
  AND
  id IN (
    SELECT customer_id FROM job_templates
    WHERE customer_id IS NOT NULL
    AND status = 'ACTIVE'
  )
);
