-- Create table for recurring weekly availability (Mon-Sun)
CREATE TABLE IF NOT EXISTS employee_weekly_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  is_available BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, day_of_week)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_weekly_availability_employee ON employee_weekly_availability(employee_id);

-- Enable RLS
ALTER TABLE employee_weekly_availability ENABLE ROW LEVEL SECURITY;

-- Employees can view and manage their own weekly availability
CREATE POLICY "Employees can manage own weekly availability"
  ON employee_weekly_availability
  FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employers can view all employee weekly availability
CREATE POLICY "Employers can view all weekly availability"
  ON employee_weekly_availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employers WHERE user_id = auth.uid()
    )
  );

-- Add column to employees table to track which mode they prefer
ALTER TABLE employees ADD COLUMN IF NOT EXISTS availability_mode TEXT DEFAULT 'custom' CHECK (availability_mode IN ('custom', 'fixed'));
