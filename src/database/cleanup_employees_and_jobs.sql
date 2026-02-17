-- ============================================
-- CLEANUP: Delete all employees & job sessions
-- KEEP: employers, customers, job templates (with customer)
-- ============================================
-- Run this in Supabase SQL Editor with service_role

BEGIN;

-- 1. Delete job session child tables
DELETE FROM evaluations;
DELETE FROM job_session_checklist_progress;
DELETE FROM job_session_progress;
DELETE FROM job_split_confirmations;
DELETE FROM job_splits;
DELETE FROM job_session_notes;
DELETE FROM schedule_messages;
DELETE FROM job_exchanges;

-- 2. Delete job sessions
DELETE FROM job_sessions;

-- 3. Delete employee child tables
DELETE FROM employee_job_training;
DELETE FROM employee_specific_availability;
DELETE FROM employee_weekly_availability;
DELETE FROM employee_availability_dates;
DELETE FROM employee_availability;
DELETE FROM employer_notes;
DELETE FROM strikes WHERE target_type = 'EMPLOYEE';

-- 4. Clear employee references on job templates
UPDATE job_templates SET preferred_employee_id = NULL WHERE preferred_employee_id IS NOT NULL;

-- 5. Delete notifications related to employees
DELETE FROM notifications WHERE user_type = 'EMPLOYEE';

-- 6. Delete conversations involving employee users
DELETE FROM messages WHERE sender_id IN (
  SELECT user_id FROM employees WHERE user_id IS NOT NULL
);
DELETE FROM conversation_participants WHERE user_id IN (
  SELECT user_id FROM employees WHERE user_id IS NOT NULL
);

-- 7. Delete FCM tokens for employee users
DELETE FROM fcm_tokens WHERE user_id IN (
  SELECT user_id FROM employees WHERE user_id IS NOT NULL
);

-- 8. Delete employees
DELETE FROM employees;

-- 9. Delete job templates NOT linked to a customer
DELETE FROM job_step_images WHERE job_step_id IN (
  SELECT js.id FROM job_steps js
  JOIN job_templates jt ON js.job_template_id = jt.id
  WHERE jt.customer_id IS NULL
);
DELETE FROM job_step_checklist WHERE job_step_id IN (
  SELECT js.id FROM job_steps js
  JOIN job_templates jt ON js.job_template_id = jt.id
  WHERE jt.customer_id IS NULL
);
DELETE FROM job_steps WHERE job_template_id IN (
  SELECT id FROM job_templates WHERE customer_id IS NULL
);
DELETE FROM job_templates WHERE customer_id IS NULL;

-- 10. Clean up empty conversations (no participants left)
DELETE FROM messages WHERE conversation_id IN (
  SELECT c.id FROM conversations c
  LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
  GROUP BY c.id HAVING COUNT(cp.id) = 0
);
DELETE FROM conversations WHERE id IN (
  SELECT c.id FROM conversations c
  LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
  GROUP BY c.id HAVING COUNT(cp.id) = 0
);

COMMIT;
