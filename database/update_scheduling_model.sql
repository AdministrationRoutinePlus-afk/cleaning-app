-- Update job scheduling model to window-based approach
-- A job window spans from (start_day, start_time) to (end_day, end_time)
-- Example: Friday 5pm to Sunday 8pm

-- Add new columns for window-based scheduling
ALTER TABLE job_templates
ADD COLUMN IF NOT EXISTS window_start_day TEXT,
ADD COLUMN IF NOT EXISTS window_end_day TEXT;

-- Remove frequency_per_week as it's no longer needed
-- (Keep the column for now to avoid breaking existing data, just don't use it)

-- Update job_sessions to store window end date
ALTER TABLE job_sessions
ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;

-- Add comment explaining the new model
COMMENT ON COLUMN job_templates.window_start_day IS 'Day the job window starts (MON, TUE, WED, THU, FRI, SAT, SUN)';
COMMENT ON COLUMN job_templates.window_end_day IS 'Day the job window ends (MON, TUE, WED, THU, FRI, SAT, SUN)';
COMMENT ON COLUMN job_templates.time_window_start IS 'Time the job window starts (e.g., 17:00)';
COMMENT ON COLUMN job_templates.time_window_end IS 'Time the job window ends (e.g., 20:00)';
COMMENT ON COLUMN job_sessions.scheduled_end_date IS 'End date of the job window for this session';
