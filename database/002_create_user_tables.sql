-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 2: User Tables (4 tables)
-- =============================================

-- 1. EMPLOYERS
CREATE TABLE employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- 2. EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  void_cheque_url TEXT,
  notes TEXT,
  status employee_status DEFAULT 'PENDING',
  created_by UUID REFERENCES employers(id),
  activated_by UUID REFERENCES employers(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- 3. CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code VARCHAR(3) NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status customer_status DEFAULT 'ACTIVE',
  created_by UUID NOT NULL REFERENCES employers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_code, created_by),
  UNIQUE(email)
);

-- 4. COMPANY INFO
CREATE TABLE company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  default_hourly_rate DECIMAL(10,2),
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);

-- Indexes for user tables
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_created_by ON employees(created_by);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_customers_customer_code ON customers(customer_code);
