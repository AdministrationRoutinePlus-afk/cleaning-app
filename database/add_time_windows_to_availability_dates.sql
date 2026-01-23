-- =============================================
-- ADD TIME WINDOWS TO EMPLOYEE AVAILABILITY DATES
-- =============================================
-- This migration adds start_time and end_time fields
-- to the employee_availability_dates table to allow
-- employees to specify specific time windows for
-- specific dates (not just available/unavailable)
-- =============================================

-- Add time window columns to employee_availability_dates
ALTER TABLE employee_availability_dates
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Add comment to explain the time window fields
COMMENT ON COLUMN employee_availability_dates.start_time IS 'Optional: Start time for availability on this specific date';
COMMENT ON COLUMN employee_availability_dates.end_time IS 'Optional: End time for availability on this specific date';
