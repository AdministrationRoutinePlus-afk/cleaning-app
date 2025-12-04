-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 1: Enum Types
-- =============================================

-- Job Template Status
CREATE TYPE job_template_status AS ENUM ('DRAFT', 'ACTIVE');

-- Job Session Status
CREATE TYPE job_session_status AS ENUM (
  'OFFERED',      -- Posted to marketplace, waiting for employee
  'CLAIMED',      -- Employee picked it, waiting approval
  'APPROVED',     -- Employer approved, scheduled
  'IN_PROGRESS',  -- Employee working on it
  'COMPLETED',    -- Job finished
  'EVALUATED',    -- Customer submitted rating
  'CANCELLED'     -- Session cancelled
);

-- Employee Status
CREATE TYPE employee_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- Customer Status
CREATE TYPE customer_status AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- Exchange Status
CREATE TYPE exchange_status AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- Strike Severity
CREATE TYPE strike_severity AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- Strike Target Type
CREATE TYPE strike_target_type AS ENUM ('CUSTOMER', 'EMPLOYEE');

-- Conversation Type
CREATE TYPE conversation_type AS ENUM ('DIRECT', 'ANNOUNCEMENT', 'EMPLOYEE_GROUP');

-- User Type (for notifications)
CREATE TYPE user_type AS ENUM ('EMPLOYER', 'EMPLOYEE', 'CUSTOMER');

-- Day of Week
CREATE TYPE day_of_week AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- Theme
CREATE TYPE theme_type AS ENUM ('LIGHT', 'DARK');
