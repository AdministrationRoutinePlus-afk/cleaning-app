-- Migration: Add MISSED and OVERDUE statuses to job_session_status enum
-- Date: 2024-12-18
-- Description: Adds new job session statuses for jobs that were never started (MISSED)
--              or started but not completed within time window (OVERDUE)

-- First, check if the enum type exists and add new values
-- PostgreSQL doesn't allow IF NOT EXISTS for enum values, so we need to check first

DO $$
BEGIN
    -- Add MISSED status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'MISSED'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_session_status')
    ) THEN
        ALTER TYPE job_session_status ADD VALUE 'MISSED';
    END IF;
END
$$;

DO $$
BEGIN
    -- Add OVERDUE status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'OVERDUE'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_session_status')
    ) THEN
        ALTER TYPE job_session_status ADD VALUE 'OVERDUE';
    END IF;
END
$$;

-- Note: After running this migration, you may want to update existing jobs
-- that should be marked as MISSED or OVERDUE. Run the following queries manually
-- or create an API endpoint to do this:

-- Mark APPROVED jobs as MISSED if their time window has passed:
/*
UPDATE job_sessions js
SET status = 'MISSED', updated_at = NOW()
FROM job_templates jt
WHERE js.job_template_id = jt.id
  AND js.status = 'APPROVED'
  AND js.scheduled_date IS NOT NULL
  AND jt.time_window_end IS NOT NULL
  AND (
    COALESCE(js.scheduled_end_date, js.scheduled_date)::date + jt.time_window_end::time
  ) < NOW();
*/

-- Mark IN_PROGRESS jobs as OVERDUE if their time window has passed:
/*
UPDATE job_sessions js
SET status = 'OVERDUE', updated_at = NOW()
FROM job_templates jt
WHERE js.job_template_id = jt.id
  AND js.status = 'IN_PROGRESS'
  AND js.scheduled_date IS NOT NULL
  AND jt.time_window_end IS NOT NULL
  AND (
    COALESCE(js.scheduled_end_date, js.scheduled_date)::date + jt.time_window_end::time
  ) < NOW();
*/
