-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 7: Availability Tables (2 tables)
-- =============================================

-- 1. EMPLOYEE AVAILABILITY (Weekly recurring)
CREATE TABLE employee_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  timezone TEXT DEFAULT 'America/Toronto',
  UNIQUE(employee_id, day_of_week)
);

-- 2. EMPLOYEE AVAILABILITY DATES (Specific date overrides)
CREATE TABLE employee_availability_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  note TEXT,
  UNIQUE(employee_id, date)
);

-- Indexes for availability tables
CREATE INDEX idx_employee_availability_employee ON employee_availability(employee_id);
CREATE INDEX idx_employee_availability_day ON employee_availability(day_of_week);
CREATE INDEX idx_employee_availability_dates_employee ON employee_availability_dates(employee_id);
CREATE INDEX idx_employee_availability_dates_date ON employee_availability_dates(date);
