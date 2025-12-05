-- Add new scheduling fields to job_templates table
-- 1. Frequency (already exists as frequency_per_week)
-- 2. Specific Dates - array of specific dates to schedule
-- 3. Date Range - start and end dates for the job
-- 4. Exclude Dates - dates to skip (holidays, etc.)
-- 5. Preferred Employee - pre-assign to specific employee

-- Add specific_dates array (for picking exact dates)
ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS specific_dates DATE[] DEFAULT NULL;

-- Add date range fields
ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;

ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;

-- Add exclude_dates array (holidays, etc.)
ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS exclude_dates DATE[] DEFAULT NULL;

-- Add preferred_employee_id
ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS preferred_employee_id UUID DEFAULT NULL REFERENCES employees(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN job_templates.specific_dates IS 'Array of specific dates for one-time scheduling (alternative to available_days)';
COMMENT ON COLUMN job_templates.start_date IS 'Start date for job sessions to be created';
COMMENT ON COLUMN job_templates.end_date IS 'End date for job sessions (optional, if null runs indefinitely for recurring)';
COMMENT ON COLUMN job_templates.exclude_dates IS 'Array of dates to skip (holidays, vacations, etc.)';
COMMENT ON COLUMN job_templates.preferred_employee_id IS 'Preferred employee to auto-assign when creating sessions';

-- Create index for preferred employee lookups
CREATE INDEX IF NOT EXISTS idx_job_templates_preferred_employee ON job_templates(preferred_employee_id);
