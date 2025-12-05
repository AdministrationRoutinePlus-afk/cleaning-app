-- Fix Settings Tables - Ensure tables exist and have proper RLS

-- First, check if employer_settings table exists and create if not
CREATE TABLE IF NOT EXISTS employer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'LIGHT',
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  logo_url TEXT,
  language VARCHAR(5) DEFAULT 'en',
  push_enabled BOOLEAN DEFAULT TRUE,
  notify_new_message BOOLEAN DEFAULT TRUE,
  notify_job_claimed BOOLEAN DEFAULT TRUE,
  notify_exchange_request BOOLEAN DEFAULT TRUE,
  reminder_2_days BOOLEAN DEFAULT TRUE,
  reminder_1_day BOOLEAN DEFAULT TRUE,
  reminder_6_hours BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);

-- Create company_info if not exists
CREATE TABLE IF NOT EXISTS company_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  default_hourly_rate NUMERIC(10,2),
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);

-- Enable RLS
ALTER TABLE employer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Employers can manage their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can view their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can insert their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can update their settings" ON employer_settings;
DROP POLICY IF EXISTS "employer_settings_select" ON employer_settings;
DROP POLICY IF EXISTS "employer_settings_insert" ON employer_settings;
DROP POLICY IF EXISTS "employer_settings_update" ON employer_settings;

DROP POLICY IF EXISTS "Employers can view own company info" ON company_info;
DROP POLICY IF EXISTS "Employers can insert company info" ON company_info;
DROP POLICY IF EXISTS "Employers can update company info" ON company_info;
DROP POLICY IF EXISTS "Employers can view their company info" ON company_info;
DROP POLICY IF EXISTS "Employers can insert their company info" ON company_info;
DROP POLICY IF EXISTS "Employers can update their company info" ON company_info;

-- Create fresh policies for employer_settings
CREATE POLICY "employer_settings_select"
ON employer_settings FOR SELECT
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "employer_settings_insert"
ON employer_settings FOR INSERT
WITH CHECK (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "employer_settings_update"
ON employer_settings FOR UPDATE
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

-- Create fresh policies for company_info
CREATE POLICY "company_info_select"
ON company_info FOR SELECT
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "company_info_insert"
ON company_info FOR INSERT
WITH CHECK (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "company_info_update"
ON company_info FOR UPDATE
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);
