DROP POLICY IF EXISTS "Employers can create schedule messages" ON schedule_messages;
DROP POLICY IF EXISTS "Employers can view all schedule messages" ON schedule_messages;
DROP POLICY IF EXISTS "Employees can view their schedule messages" ON schedule_messages;

CREATE POLICY "Employers can create schedule messages"
ON schedule_messages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

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

CREATE POLICY "Employees can update their schedule messages"
ON schedule_messages FOR UPDATE
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);
