-- Add REFUSED status to job_session_status enum
-- This allows employers to refuse employee claims

-- First check if the value already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REFUSED'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_session_status')
  ) THEN
    ALTER TYPE job_session_status ADD VALUE 'REFUSED' AFTER 'APPROVED';
  END IF;
END $$;
