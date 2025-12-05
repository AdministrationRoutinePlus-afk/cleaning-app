DROP POLICY IF EXISTS "Employers can create schedule messages" ON schedule_messages;
DROP POLICY IF EXISTS "Employers can view all schedule messages" ON schedule_messages;
DROP POLICY IF EXISTS "Employees can view their schedule messages" ON schedule_messages;
DROP POLICY IF EXISTS "Employees can update their schedule messages" ON schedule_messages;

CREATE POLICY "schedule_messages_insert"
ON schedule_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "schedule_messages_select_employer"
ON schedule_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "schedule_messages_select_employee"
ON schedule_messages FOR SELECT
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

CREATE POLICY "schedule_messages_update"
ON schedule_messages FOR UPDATE
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM employers WHERE user_id = auth.uid())
);
