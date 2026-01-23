-- Migration: Add employee_specific_availability table
-- Purpose: Allow employees to set availability for specific dates (next 2 weeks)
-- with lock option to prevent changes

CREATE TABLE IF NOT EXISTS employee_specific_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_specific_availability_employee_date
  ON employee_specific_availability(employee_id, date);

-- Enable RLS
ALTER TABLE employee_specific_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own availability
CREATE POLICY "Employees can view own specific availability"
  ON employee_specific_availability
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Employees can insert their own availability
CREATE POLICY "Employees can insert own specific availability"
  ON employee_specific_availability
  FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Employees can update their own availability
CREATE POLICY "Employees can update own specific availability"
  ON employee_specific_availability
  FOR UPDATE
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Employees can delete their own availability
CREATE POLICY "Employees can delete own specific availability"
  ON employee_specific_availability
  FOR DELETE
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Employers can view all employee availability
CREATE POLICY "Employers can view all specific availability"
  ON employee_specific_availability
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employers WHERE user_id = auth.uid()
    )
  );
